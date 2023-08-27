"""
    A simple custom model provider to add to the ChainForge interface,
    to support Cohere AI text completions through their Python API.

    NOTE: You must have the `cohere` package installed and an API key.
"""
from chainforge.providers import provider
import cohere

# Init the Cohere client (replace with your Cohere API Key)
co = cohere.Client('<YOUR_API_KEY>')

# JSON schemas to pass react-jsonschema-form, one for this endpoints' settings and one to describe the settings UI.
COHERE_SETTINGS_SCHEMA = {
  "settings": {
    "temperature": {
      "type": "number",
      "title": "temperature",
      "description": "Controls the 'creativity' or randomness of the response.",
      "default": 0.75,
      "minimum": 0,
      "maximum": 5.0,
      "multipleOf": 0.01,
    },
    "max_tokens": {
      "type": "integer",
      "title": "max_tokens",
      "description": "Maximum number of tokens to generate in the response.",
      "default": 100,
      "minimum": 1,
      "maximum": 1024,
    },
  },
  "ui": {
    "temperature": {
      "ui:help": "Defaults to 1.0.",
      "ui:widget": "range"
    },
    "max_tokens": {
      "ui:help": "Defaults to 100.",
      "ui:widget": "range"
    },
  }
}

# Our custom model provider for Cohere's text generation API.
@provider(name="Cohere",
          emoji="🖇", 
          models=['command', 'command-nightly', 'command-light', 'command-light-nightly'],
          rate_limit="sequential", # enter "sequential" for blocking; an integer N > 0 means N is the max mumber of requests per minute. 
          settings_schema=COHERE_SETTINGS_SCHEMA)
def CohereCompletion(prompt: str, model: str, temperature: float = 0.75, **kwargs) -> str:
    print(f"Calling Cohere model {model} with prompt '{prompt}'...")
    response = co.generate(model=model, prompt=prompt, temperature=temperature, **kwargs)
    return response.generations[0].text
