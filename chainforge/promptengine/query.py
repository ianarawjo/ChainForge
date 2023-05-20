from abc import abstractmethod
from typing import List, Dict, Tuple, Iterator, Union
import json, os, asyncio, random, string
from chainforge.promptengine.utils import LLM, call_chatgpt, call_dalai, call_anthropic, call_google_palm, is_valid_filepath, is_valid_json, extract_responses, merge_response_objs
from chainforge.promptengine.template import PromptTemplate, PromptPermutationGenerator

# LLM APIs often have rate limits, which control number of requests. E.g., OpenAI: https://platform.openai.com/account/rate-limits
#   For a basic organization in OpenAI, GPT3.5 is currently 3500 and GPT4 is 200 RPM (requests per minute).
#   For Anthropic evaluaton preview of Claude, can only send 1 request at a time (synchronously).
# A 'cheap' version of controlling for rate limits is to wait a few seconds between batches of requests being sent off.
# The following is only a guideline, and a bit on the conservative side. 
MAX_SIMULTANEOUS_REQUESTS = { 
    LLM.ChatGPT: (30, 10),  # max 30 requests a batch; wait 10 seconds between
    LLM.GPT4: (5, 10),  # max 5 requests a batch; wait 10 seconds between
    LLM.PaLM2: (4, 10),  # max 30 requests per minute; so do 4 per batch, 10 seconds between
    LLM.Alpaca7B: (1, 0),  # 1 indicates synchronous
}

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
    
    async def gen_responses(self, properties, llm: LLM, n: int = 1, temperature: float = 1.0) -> Iterator[Dict]:
        """
            Calls LLM 'llm' with all prompts, and yields responses as dicts in format {prompt, query, response, llm, info}.

            Queries are sent off asynchronously (if possible).
            Yields responses as they come in.

            By default, for each response, this also saves reponses to disk as JSON at the filepath given during init. 
            (Very useful for saving money in case something goes awry!)
            To clear the cached responses, call clear_cached_responses(). 

            Do not override this function.
        """
        # Double-check that properties is the correct type (JSON dict):
        if not is_valid_json(properties):
            raise ValueError(f"Properties argument is not valid JSON.")

        # Load any cache'd responses
        responses = self._load_cached_responses()

        # Query LLM with each prompt, yield + cache the responses
        tasks = []
        max_req, wait_secs = MAX_SIMULTANEOUS_REQUESTS[llm] if llm in MAX_SIMULTANEOUS_REQUESTS else (1, 0)
        
        for num_queries, prompt in enumerate(self.gen_prompts(properties)):
            if isinstance(prompt, PromptTemplate) and not prompt.is_concrete():
                raise Exception(f"Cannot send a prompt '{prompt}' to LLM: Prompt is a template.")

            prompt_str = str(prompt)
            info = prompt.fill_history

            cached_resp = responses[prompt_str] if prompt_str in responses else None
            extracted_resps = cached_resp["responses"] if cached_resp is not None else []
            
            # First check if there is already a response for this item. If so, we can save an LLM call:
            if cached_resp and len(extracted_resps) >= n:
                print(f"   - Found cache'd response for prompt {prompt_str}. Using...")
                yield {
                    "prompt": prompt_str,
                    "query": cached_resp["query"],
                    "responses": extracted_resps[:n],
                    "raw_response": cached_resp["raw_response"],
                    "llm": cached_resp["llm"] if "llm" in cached_resp else LLM.ChatGPT.value,
                    # We want to use the new info, since 'vars' could have changed even though 
                    # the prompt text is the same (e.g., "this is a tool -> this is a {x} where x='tool'")
                    "info": info,
                }
                continue

            if max_req > 1:
                if (num_queries+1) % max_req == 0:
                    print(f"Batch rate limit of {max_req} reached. Waiting {wait_secs} seconds until sending further requests...")
                    await asyncio.sleep(wait_secs)
                
                # Call the LLM asynchronously to generate a response
                tasks.append(self._prompt_llm(llm, prompt, n, temperature, past_resp_obj=cached_resp))
            else:
                # Blocking. Await + yield a single LLM call.
                _, query, response, past_resp_obj = await self._prompt_llm(llm, prompt, n, temperature, past_resp_obj=cached_resp)

                # Create a response obj to represent the response
                resp_obj = {
                    "prompt": str(prompt), 
                    "query": query, 
                    "responses": extract_responses(response, llm),
                    "raw_response": response,
                    "llm": llm.value,
                    "info": info,
                }

                # Merge the response obj with the past one, if necessary
                if past_resp_obj is not None:
                    resp_obj = merge_response_objs(resp_obj, past_resp_obj)

                # Save the response to a JSON file
                responses[resp_obj["prompt"]] = {key: val for key, val in resp_obj.items()}
                self._cache_responses(responses)

                # Yield the response
                yield resp_obj
        
        # Yield responses as they come in
        for task in asyncio.as_completed(tasks):
            # Collect the response from the earliest completed task
            prompt, query, response, past_resp_obj = await task

            # Each prompt has a history of what was filled in from its base template.
            # This data --like, "class", "language", "library" etc --can be useful when parsing responses.
            info = prompt.fill_history

            # Create a response obj to represent the response
            resp_obj = {
                "prompt": str(prompt), 
                "query": query, 
                "responses": extract_responses(response, llm),
                "raw_response": response,
                "llm": llm.value,
                "info": info,
            }

            # Merge the response obj with the past one, if necessary
            if past_resp_obj is not None:
                resp_obj = merge_response_objs(resp_obj, past_resp_obj)
            
            # Save the response to a JSON file
            # NOTE: We do this to save money --in case something breaks between calls, can ensure we got the data!
            responses[resp_obj["prompt"]] = {key: val for key, val in resp_obj.items()}
            self._cache_responses(responses)

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
        with open(self._filepath, "w") as f:
            json.dump(responses, f)
    
    def clear_cached_responses(self) -> None:
        self._cache_responses({})

    async def _prompt_llm(self, llm: LLM, prompt: PromptTemplate, n: int = 1, temperature: float = 1.0, past_resp_obj: Union[Dict, None] = None) -> Tuple[str, Dict, Union[List, Dict], Union[Dict, None]]:
        # Detect how many responses we have already (from cache obj past_resp_obj)
        if past_resp_obj is not None:
            # How many *new* queries we need to send: 
            # NOTE: The check n > len(past_resp_obj["responses"]) should occur prior to calling this function. 
            n = n - len(past_resp_obj["responses"])

        if llm is LLM.ChatGPT or llm is LLM.GPT4:
            query, response = await call_chatgpt(str(prompt), model=llm, n=n, temperature=temperature)
        elif llm is LLM.PaLM2:
            query, response = await call_google_palm(prompt=str(prompt), model=llm, n=n, temperature=temperature)
        elif llm is LLM.Alpaca7B:
            query, response = await call_dalai(model=llm, port=4000, prompt=str(prompt), n=n, temperature=temperature)
        elif llm.value[:6] == 'claude':
            query, response = await call_anthropic(prompt=str(prompt), model=llm, n=n, temperature=temperature)
        else:
            raise Exception(f"Language model {llm} is not supported.")
        
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
    async def _prompt_llm(self, llm: LLM, prompt: PromptTemplate, n: int = 1, temperature: float = 1.0) -> Tuple[Dict, Dict]:
        # Wait a random amount of time, to simulate wait times from real queries
        await asyncio.sleep(random.uniform(0.1, 3))
        # Return a random string of characters of random length (within a predefined range)
        return prompt, *({'prompt': str(prompt)}, [''.join(random.choice(string.ascii_letters) for i in range(random.randint(25, 80))) for _ in range(n)])