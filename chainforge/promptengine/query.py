from abc import abstractmethod
from typing import List, Dict, Tuple, Iterator, Union, Optional
import json, os, asyncio, random, string
from chainforge.promptengine.utils import call_chatgpt, call_dalai, call_anthropic, call_google_palm, call_azure_openai, is_valid_filepath, is_valid_json, extract_responses, merge_response_objs
from chainforge.promptengine.models import LLM, RATE_LIMITS
from chainforge.promptengine.template import PromptTemplate, PromptPermutationGenerator

class LLMResponseException(Exception):
    """ Raised when there is an error generating a single response from an LLM """
    pass

"""
    Abstract class that captures a generic querying interface to prompt LLMs
"""
class PromptPipeline:
    def __init__(self, storageFile: str):
        if not is_valid_filepath(storageFile):
            raise IOError(f"Filepath {storageFile} is invalid, or you do not have write access.")

        self._filepath = storageFile

    @abstractmethod
    def gen_prompts(self, properties) -> Iterator[PromptTemplate]:
        raise NotImplementedError("Please Implement the gen_prompts method")
    
    async def gen_responses(self, properties, llm: LLM, n: int = 1, temperature: float = 1.0, **llm_params) -> Iterator[Union[Dict, LLMResponseException]]:
        """
            Calls LLM 'llm' with all prompts, and yields responses as dicts in format {prompt, query, response, llm, info}.

            Queries are sent off asynchronously (if possible).
            Yields responses as they come in. All LLM calls that yield errors (e.g., 'rate limit' error)
            will yield an individual LLMResponseException, so downstream tasks must check for this exception type.

            By default, for each response successfully collected, this also saves reponses to disk as JSON at the filepath given during init. 
            (Very useful for saving money in case something goes awry!)
            To clear the cached responses, call clear_cached_responses(). 

            NOTE: The reason we collect, rather than raise, LLMResponseExceptions is because some API calls 
                  may still succeed, even if some fail. We don't want to stop listening to pending API calls, 
                  because we may lose money. Instead, we fail selectively. 

            Do not override this function.
        """
        # Double-check that properties is the correct type (JSON dict):
        if not is_valid_json(properties):
            raise ValueError("Properties argument is not valid JSON.")

        # Load any cache'd responses
        responses = self._load_cached_responses()

        # Query LLM with each prompt, yield + cache the responses
        tasks = []
        max_req, wait_secs = RATE_LIMITS[llm] if llm in RATE_LIMITS else (1, 0)
        num_queries_sent = -1
        
        for prompt in self.gen_prompts(properties):
            if isinstance(prompt, PromptTemplate) and not prompt.is_concrete():
                raise Exception(f"Cannot send a prompt '{prompt}' to LLM: Prompt is a template.")

            prompt_str = str(prompt)
            info = prompt.fill_history
            metavars = prompt.metavars

            cached_resp = responses[prompt_str] if prompt_str in responses else None
            extracted_resps = cached_resp["responses"] if cached_resp is not None else []
            
            # First check if there is already a response for this item under these settings. If so, we can save an LLM call:
            if cached_resp and len(extracted_resps) >= n:
                print(f" - Found cache'd response for prompt {prompt_str}. Using...")
                yield {
                    "prompt": prompt_str,
                    "query": cached_resp["query"],
                    "responses": extracted_resps[:n],
                    "raw_response": cached_resp["raw_response"],
                    "llm": cached_resp["llm"] if "llm" in cached_resp else LLM.OpenAI_ChatGPT.value,
                    # We want to use the new info, since 'vars' could have changed even though 
                    # the prompt text is the same (e.g., "this is a tool -> this is a {x} where x='tool'")
                    "info": info,
                    "metavars": metavars
                }
                continue

            num_queries_sent += 1

            if max_req > 1:                
                # Call the LLM asynchronously to generate a response, sending off
                # requests in batches of size 'max_req' separated by seconds 'wait_secs' to avoid hitting rate limit
                tasks.append(self._prompt_llm(llm=llm, 
                                              prompt=prompt, 
                                              n=n, 
                                              temperature=temperature, 
                                              past_resp_obj=cached_resp, 
                                              query_number=num_queries_sent, 
                                              rate_limit_batch_size=max_req, 
                                              rate_limit_wait_secs=wait_secs, 
                                              **llm_params))
            else:
                # Block. Await + yield a single LLM call.
                _, query, response, past_resp_obj = await self._prompt_llm(llm=llm, 
                                                                           prompt=prompt, 
                                                                           n=n, 
                                                                           temperature=temperature, 
                                                                           past_resp_obj=cached_resp, 
                                                                           **llm_params)

                # Check for selective failure
                if query is None and isinstance(response, LLMResponseException):
                    yield response  # yield the LLMResponseException
                    continue

                # Create a response obj to represent the response
                resp_obj = {
                    "prompt": str(prompt), 
                    "query": query, 
                    "responses": extract_responses(response, llm),
                    "raw_response": response,
                    "llm": llm.value,
                    "info": info,
                    "metavars": metavars
                }

                # Merge the response obj with the past one, if necessary
                if past_resp_obj is not None:
                    resp_obj = merge_response_objs(resp_obj, past_resp_obj)

                # Save the current state of cache'd responses to a JSON file
                responses[resp_obj["prompt"]] = resp_obj
                self._cache_responses(responses)

                print(f" - collected response from {llm.value} for prompt:", resp_obj['prompt'])

                # Yield the response
                yield resp_obj
        
        # Yield responses as they come in
        for task in asyncio.as_completed(tasks):
            # Collect the response from the earliest completed task
            prompt, query, response, past_resp_obj = await task

            # Check for selective failure
            if query is None and isinstance(response, LLMResponseException):
                yield response  # yield the LLMResponseException
                continue

            # Each prompt has a history of what was filled in from its base template.
            # This data --like, "class", "language", "library" etc --can be useful when parsing responses.
            info = prompt.fill_history
            metavars = prompt.metavars

            # Create a response obj to represent the response
            resp_obj = {
                "prompt": str(prompt), 
                "query": query, 
                "responses": extract_responses(response, llm),
                "raw_response": response,
                "llm": llm.value,
                "info": info,
                "metavars": metavars,
            }

            # Merge the response obj with the past one, if necessary
            if past_resp_obj is not None:
                resp_obj = merge_response_objs(resp_obj, past_resp_obj)

            # Save the current state of cache'd responses to a JSON file
            # NOTE: We do this to save money --in case something breaks between calls, can ensure we got the data!
            responses[resp_obj["prompt"]] = resp_obj
            self._cache_responses(responses)

            print(f" - collected response from {llm.value} for prompt:", resp_obj['prompt'])

            # Yield the response
            yield resp_obj
    
    def _load_cached_responses(self) -> Dict:
        """
            Loads saved responses of JSON at self._filepath. 
            Useful for continuing if computation was interrupted halfway through. 
        """
        if os.path.isfile(self._filepath):
            with open(self._filepath, encoding="utf-8") as f:
                responses = json.load(f)
            return responses
        else:
            return {}
    
    def _cache_responses(self, responses) -> None:
        with open(self._filepath, "w", encoding='utf-8') as f:
            json.dump(responses, f)
    
    def clear_cached_responses(self) -> None:
        self._cache_responses({})

    async def _prompt_llm(self, 
                          llm: LLM, 
                          prompt: PromptTemplate, 
                          n: int = 1, 
                          temperature: float = 1.0, 
                          past_resp_obj: Optional[Dict] = None,
                          query_number: Optional[int] = None,
                          rate_limit_batch_size: Optional[int] = None,
                          rate_limit_wait_secs: Optional[float] = None,
                          **llm_params) -> Tuple[str, Dict, Union[List, Dict], Union[Dict, None]]:
        # Detect how many responses we have already (from cache obj past_resp_obj)
        if past_resp_obj is not None:
            # How many *new* queries we need to send: 
            # NOTE: The check n > len(past_resp_obj["responses"]) should occur prior to calling this function. 
            n = n - len(past_resp_obj["responses"])
        
        # Block asynchronously when we exceed rate limits
        if query_number is not None and rate_limit_batch_size is not None and rate_limit_wait_secs is not None and rate_limit_batch_size >= 1 and rate_limit_wait_secs > 0:
            batch_num = int(query_number / rate_limit_batch_size)
            if batch_num > 0:
                # We've exceeded the estimated batch rate limit and need to wait the appropriate seconds before sending off new API calls:
                wait_secs = rate_limit_wait_secs * batch_num
                if query_number % rate_limit_batch_size == 0:  # Print when we start blocking, for each batch
                    print(f"Batch rate limit of {rate_limit_batch_size} reached for LLM {llm}. Waiting {wait_secs} seconds until sending request batch #{batch_num}...")
                await asyncio.sleep(wait_secs)

        # Get the correct API call for the given LLM:
        call_llm = None
        if llm.name[:6] == 'OpenAI':
            call_llm = call_chatgpt
        elif llm.name[:5] == 'Azure':
            call_llm = call_azure_openai
        elif llm.name[:5] == 'PaLM2':
            call_llm = call_google_palm
        elif llm.name[:5] == 'Dalai':
            call_llm = call_dalai
        elif llm.value[:6] == 'claude':
            call_llm = call_anthropic
        else:
            raise Exception(f"Language model {llm} is not supported.")
        
        # Now try to call the API. If it fails for whatever reason, 'soft fail' by returning
        # an LLMResponseException object as the 'response'.
        try:
            query, response = await call_llm(prompt=str(prompt), model=llm, n=n, temperature=temperature, **llm_params)
        except Exception as e:
            return prompt, None, LLMResponseException(str(e)), None
        
        return prompt, query, response, past_resp_obj

"""
    Most basic prompt pipeline: given a prompt (and any variables, if it's a template), 
    query the LLM with all prompt permutations, and cache responses.
"""
class PromptLLM(PromptPipeline):
    def __init__(self, template: str, storageFile: str):
        self._template = PromptTemplate(template)
        super().__init__(storageFile)
    def gen_prompts(self, properties: dict) -> Iterator[PromptTemplate]:
        gen_prompts = PromptPermutationGenerator(self._template)
        return gen_prompts(properties)


"""
    A dummy class that spoofs LLM responses. Used for testing.
"""
class PromptLLMDummy(PromptLLM):
    def __init__(self, template: str, storageFile: str):
        # Hijack the 'extract_responses' method so that for whichever 'llm' parameter,
        # it will just return the response verbatim (since dummy responses will always be strings)
        global extract_responses
        extract_responses = lambda response, llm: response
        super().__init__(template, storageFile)
    async def _prompt_llm(self, llm: LLM, prompt: PromptTemplate, n: int = 1, temperature: float = 1.0, past_resp_obj: Optional[Dict] = None, **params) -> Tuple[Dict, Dict]:
        # Wait a random amount of time, to simulate wait times from real queries
        await asyncio.sleep(random.uniform(0.1, 3))

        if random.random() > 0.2:
            # Return a random string of characters of random length (within a predefined range)
            return prompt, {'prompt': str(prompt)}, [''.join(random.choice(string.ascii_letters) for i in range(random.randint(25, 80))) for _ in range(n)], past_resp_obj
        else:
            # Return a mock 'error' making the API request
            return prompt, None, LLMResponseException('Dummy error'), past_resp_obj