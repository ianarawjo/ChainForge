from typing import Tuple, Dict
import asyncio, time

DALAI_MODEL = None
DALAI_RESPONSE = None

async def call_dalai(prompt: str, model: str, server: str="http://localhost:4000", n: int = 1, temperature: float = 0.5,  **params) -> Tuple[Dict, Dict]:
    """
        Calls a Dalai server running LLMs Alpaca, Llama, etc locally.
        Returns the raw query and response JSON dicts. 

        Parameters:
            - model: The LLM model, whose value is the name known byt Dalai; e.g. 'alpaca.7b'
            - port: The port of the local server where Dalai is running. By default 4000.
            - prompt: The prompt to pass to the LLM.
            - n: How many times to query. If n > 1, this will continue to query the LLM 'n' times and collect all responses.
            - temperature: The temperature to query at
            - params: Any other Dalai-specific params to pass. For more info, see below or https://cocktailpeanut.github.io/dalai/#/?id=syntax-1 

        TODO: Currently, this uses a modified dalaipy library for simplicity; however, in the future we might remove this dependency. 
    """
    # Import and load upon first run
    global DALAI_MODEL, DALAI_RESPONSE
    if not server or len(server.strip()) == 0:  # In case user passed a blank server name, revert to default on port 4000
        server = "http://localhost:4000"
    if DALAI_MODEL is None:
        from chainforge.providers.dalaipy import Dalai
        DALAI_MODEL = Dalai(server)
    elif DALAI_MODEL.server != server:  # if the port has changed, we need to create a new model
        DALAI_MODEL = Dalai(server)
    
    # Make sure server is connected
    DALAI_MODEL.connect()

    # Create settings dict to pass to Dalai as args
    def_params = {'n_predict':128, 'repeat_last_n':64, 'repeat_penalty':1.3, 'seed':-1, 'threads':4, 'top_k':40, 'top_p':0.9}
    for key in params:
        if key in def_params:
            def_params[key] = params[key]
        else:
            print(f"Attempted to pass unsupported param '{key}' to Dalai. Ignoring.")
    
    # Create full query to Dalai
    query = {
        'prompt': prompt,
        'model': model,
        'id': str(round(time.time()*1000)),
        'temp': temperature,
        **def_params
    }

    # Create spot to put response and a callback that sets it
    DALAI_RESPONSE = None
    def on_finish(r):
        global DALAI_RESPONSE
        DALAI_RESPONSE = r
    
    print(f"Calling Dalai model '{query['model']}' with prompt '{query['prompt']}' (n={n}). Please be patient...")

    # Repeat call n times
    responses = []
    while len(responses) < n:

        # Call the Dalai model 
        req = DALAI_MODEL.generate_request(**query)
        sent_req_success = DALAI_MODEL.generate(req, on_finish=on_finish)

        if not sent_req_success:
            print("Something went wrong pinging the Dalai server. Returning None.")
            return None, None

        # Blocking --wait for request to complete: 
        while DALAI_RESPONSE is None:
            await asyncio.sleep(0.01)

        response = DALAI_RESPONSE['response']
        if response[-5:] == '<end>':  # strip ending <end> tag, if present
            response = response[:-5]
        if response.index('\r\n') > -1:  # strip off the prompt, which is included in the result up to \r\n:
            response = response[(response.index('\r\n')+2):]
        DALAI_RESPONSE = None

        responses.append(response)
        print(f'Response {len(responses)} of {n}:\n', response)

    # Disconnect from the server
    DALAI_MODEL.disconnect()

    return query, responses