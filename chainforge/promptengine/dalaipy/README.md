# dalaipy
A Python Wrapper for [Dalai](https://github.com/cocktailpeanut/dalai)!

Dalai is a simple, and easy way to run LLaMa and Alpaca locally.

## Installation
`pip install dalaipy==2.0.2`

https://pypi.org/project/dalaipy/2.0.2/

## Instructions
1. Go to [Dalai](https://github.com/cocktailpeanut/dalai), and set up your model of choice on your system (either Mac, Windows, or Linux). The readme provides clear explanations!
2. Once you can run `npx dalai serve`, run the server and test out your model of choice.
3. Install dalaipy per the instructions above, and make your first request:
```
from dalaipy.src import Dalai

model = Dalai()
# your_model can be one of the following, "alpaca.7B", "alpaca.13B", "llama.7B", "llama.13B", "llama.30B", or "llama.65B", and is dictated by which model you installed
request_dict = model.generate_request("What is the capital of the United States?", your_model)
print(model.request(request_dict))
```

## Credits
[@cocktailpeanut](https://github.com/cocktailpeanut) - the owner of Dalai

[@quadrismegistus](https://github.com/quadrismegistus) - made a notebook with the original idea of using python-socketio to communicate with the web server

## Docs
### Dalai Class
- generate_request() - `model.generate_request(prompt, model)`
    - `prompt`: **(required)** the prompt string
    - `model`: **(required)** the model that should be used, in the form of a string
        - `alpaca.7B`
        - `alpaca.13B`
        - `llama.7B`
        - `llama.13B`
        - `llama.30B`
        - `llama.65B`
    - `id`: the request ID (defaut is '0')
    - `n_predict`: the number of tokens to return (default is 128)
    - `repeat_last_n`: default is 64
    - `repeat_penalty`: default is 1.3
    - `seed`: the seed (default is -1)
    - `temp`: the temperature of the request (default is 0.5)
    - `threads`: the number of threads to use (default is 4)
    - `top_k`: default is 40
    - `top_p`: default is 0.9

- request() - `model.request(prompt)`
    - `prompt`: **(required)** the prompt string
    - `prettify`: whether or not to clean and output just the string, or the whole request dictionary (default is `True`)
