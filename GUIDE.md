# User Guide

An explanation of the nodes and some features available in ChainForge. 

## Nodes

### Prompt Node

Prompt LLMs for responses. GPT3.5 (ChatGPT) is added by default. 
Click `Add +` in the drop-down list to add an LLM, or click the Trash icon to remove one. 
When you are ready, hover over the Run button:

A tooltip will provide feedback on how many responses it will send (sometimes
this can be quite a lot if you provide many values to a template variable). 
If you are sure, press Run:

ChainForge will now query all LLMs at once, simultaneously (within reasonable rate limits),
and provides live feedback on its current progress:

> **Note**
> Once requests are sent, you cannot currently stop them mid-way through. 
> However, all responses from an LLM are cache'd the moment ChainForge receives them, so you won't lose money if something goes wrong.
> Due to the asynchronous nature of API requests, sometimes requests may fail to complete or hang.
> If you get stuck or want to stop sending requests, restart the backend server by pressing `Ctrl+C` twice and re-running `chainforge serve`. 
> We are working on improving the user experience in the future. 

------------------
### TextFields Node

Each text field is 
Click the `+` button to add a text field. 

You can also add a prompt template as a field, and an input hook will appear:

This way, you can chain prompt templates together to, for instance, test what the best prompt _template_ is for your use case.
All prompt variables will be accessible later on in an evaluation chain, including the templates themselves. 

------------------
### CSV Node
Create a comma-separated list of values to input into a prompt parameter. 
You can escape `,` by enclosing values in quotes, e.g. `"this,is,an,example"`. 

You cannot currently add a prompt template to a CSV node.

------------------
### Inspect node

Inspect responses from Prompt or Evaluator nodes. 
Use `Export Data` to export the data as an Excel `xlsx` file: 

If you've scored responses with an evaluator node, this will export the scores as well:

------------------
### Python Evaluator Node

Score responses by writing an evaluate function in Python. 

The `response` argument is a `ResponseInfo` object: 
```python
class ResponseInfo:
    text: str
    prompt: str
    var: dict
    llm: str
```
Use `var` to get access to prompt parameter values. For instance, suppose we have the prompt:

> What year was {game} released?

We can use `response.var['game']` to get the value of `game` input to the specific prompt that generated an individual response.
You might use this data to, for instance, compare the output value (say a year) to a database:

```python
import re, ...

def release_year(game):
  # ... Lookup the game's year in a database here ...

def extract_year(text):
  # Do some regex here to extract a year from response text:
  matches = re.findall(r'\b(19|20)\d{2}\b', text)
  return matches[0] if len(matches) > 0 else ''

def evaluate(response):
  return release_year(response.var['game']) == extract_year(response.text)
```

Return values can currently be the following types:
 - Numeric
 - Boolean (`true` or `false`)
 - Dictionaries with numeric data (key-value pairs of type `{<str>: <number>}`

If you return a dictionary with more than one key, metrics will be plotted in a parallel coordinates plot. For example:

You can also use a single-key dictionary to label the metric axis:

------------------
### Vis Node
