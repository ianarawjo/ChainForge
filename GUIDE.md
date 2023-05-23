# User Guide

An explanation of all nodes and features currently available in the alpha version of ChainForge. 

## Prompt Node

**Set a prompt and number of responses requested**: 
Write your prompt in the text field at the top.
Use `{}` template hooks to declare input variables, which you can attach to other nodes. For example, here is a prompt with one input parameter:

<img width="702" alt="Screen Shot 2023-05-22 at 12 40 12 PM" src="https://github.com/ianarawjo/ChainForge/assets/5251713/520206b7-6ed5-43fa-947e-bb89b889be9a">

Increase `Num responses per prompt` to sample `n` responses for every query to every LLM.

Note that if you have multiple template variables, ChainForge will calculate the _cross product_ of all inputs: all combinations of all input variables. 
For instance, for the prompt `What {time} did {game} come out in the US?` where `time` could be `year` or `month`, and `game` could be one of 3 games `Pokemon Blue`, `Kirby's Dream Land`, and `Ocarina of Time`, we have `2 x 3 = 6` combinations:

 - `What year did Pokemon Blue come out in the US?`
 - `What month did Pokemon Blue come out in the US?`
 - `What year did Kirby's Dream Land come out in the US?`
 - `What month did Kirby's Dream Land come out in the US?`
 - `What year did`... etc etc

**Add / change LLMs to query**: Click `Add +` in the drop-down list to add an LLM, or click the Trash icon to remove one. GPT3.5 (ChatGPT) is added by default. (See the `INSTALL_GUIDE.md` for currently supported LLMs.) 

**Prompt the selected LLMs with the provided query**:
When you are ready, hover over the Run button:

<img width="415" alt="Screen Shot 2023-05-22 at 1 45 43 PM" src="https://github.com/ianarawjo/ChainForge/assets/5251713/309a7bb6-609b-4947-a32c-4f96f474b914">

A tooltip will provide feedback on how many responses it will send (sometimes
this can be quite a lot if you provide many values to a template variable). 
If you are sure, press Run:

![prompt-node-run-example](https://github.com/ianarawjo/ChainForge/assets/5251713/888c9805-442c-43a2-8402-f003a96f56db)

ChainForge will now query all LLMs at once, simultaneously (within reasonable rate limits),
and provides live feedback on its current progress.

> **Note**
> Once requests are sent, you cannot currently stop them mid-way through. 
> However, all responses from an LLM are cache'd the moment ChainForge receives them, so you won't lose money if something goes wrong.
> Due to the asynchronous nature of API requests, sometimes requests may fail to complete or hang.
> If you get stuck or want to stop sending requests, restart the backend server by pressing `Ctrl+C` twice and re-running `chainforge serve`. 
> We are working on improving the user experience in the future. 

------------------
## TextFields Node

Text fields provide a way to define input values to prompt parameters. Each text field counts as a single input value to a prompt template. 
Click the `+` button to add a text field:

<img width="348" alt="Screen Shot 2023-05-22 at 1 48 02 PM" src="https://github.com/ianarawjo/ChainForge/assets/5251713/3470aec2-3081-4be9-8ceb-6349ba735800">

You can also add a prompt template as a field, and an input hook will appear:

<img width="365" alt="Screen Shot 2023-05-22 at 1 47 37 PM" src="https://github.com/ianarawjo/ChainForge/assets/5251713/00ea616a-b186-4dc3-ba3e-5cf80de1bf74">

This way, you can chain prompt templates together to, for instance, test what the best prompt _template_ is for your use case.
All prompt variables will be accessible later on in an evaluation chain, including the templates themselves.

------------------
## CSV Node
Create a comma-separated list of values to input into a prompt parameter:

<img width="334" alt="Screen Shot 2023-05-22 at 1 48 45 PM" src="https://github.com/ianarawjo/ChainForge/assets/5251713/2a521187-d847-4854-a21f-8d4152cd5f9e">

You can escape `,` by enclosing values in quotes, e.g. `"this,is,an,example"`. 
_You cannot currently add a prompt template to a CSV node._

------------------
## Inspect node

Inspect responses by attaching an Inspect node to Prompt or Evaluator nodes. Group responses by input variables or LLMs, at arbitrary depth:

<img width="385" alt="Screen Shot 2023-05-19 at 4 14 38 PM" src="https://github.com/ianarawjo/ChainForge/assets/5251713/0a02de85-776d-4881-b4d2-020b9f36f537">

Use `Export Data` to export the data as an Excel `xlsx` file, e.g:

<img width="351" alt="Screen Shot 2023-05-19 at 11 13 22 AM" src="https://github.com/ianarawjo/ChainForge/assets/5251713/22781ceb-64cf-4420-9034-aebc57803625">

will produce: 

<img width="1426" alt="Screen Shot 2023-05-19 at 11 16 46 AM" src="https://github.com/ianarawjo/ChainForge/assets/5251713/169313cb-43a0-480c-bfee-01956067d4af">

If you've scored responses with an evaluator node, this exports the scores as well.

------------------
## Python Evaluator Node

Score responses by writing an evaluate function in Python. 
You must declare a `def evaluate(response)` function which will be called by ChainForge for every response in the input.
You can add other helper functions or `import` statements as well.

For instance, here is a basic evaluator to check the length of the response:

<img width="355" alt="Screen Shot 2023-05-22 at 1 50 13 PM" src="https://github.com/ianarawjo/ChainForge/assets/5251713/bfc0b5e5-92a9-46d2-9df6-5792843466e1">

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
  # Use a regex to extract a year from the response text:
  matches = re.findall(r'\b(19|20)\d{2}\b', text)
  return matches[0] if len(matches) > 0 else ''

def evaluate(response):
  return release_year(response.var['game']) == extract_year(response.text)
```

**Return values must currently be of the following types:**
 - Numeric
 - Boolean (`true` or `false`)
 - Dictionaries with numeric data (key-value pairs of type `{<str>: <number>}`

If you return a dictionary with more than one key, metrics will be plotted in a parallel coordinates plot. For example, for four keys in the dictionary:

<img width="473" alt="Screen Shot 2023-05-18 at 11 10 10 AM" src="https://github.com/ianarawjo/ChainForge/assets/5251713/f08ef183-782e-4e2c-9402-f2494715c92d">

You can also use a single-key dictionary to label the metric axis of a Vis Node:

<img width="982" alt="Screen Shot 2023-05-22 at 12 57 02 PM" src="https://github.com/ianarawjo/ChainForge/assets/5251713/31581d14-1cf2-4e3d-8755-fcb812937e89">

------------------
## Vis Node

Visualization nodes are the heart of ChainForge. 
Plot evaluation scores quickly with a plot that makes sense for the shape of the input data.

To plot data, attached the output of an Evaluator node to a Vis Node. The output you see
will depend on the shape of your input data (see below). Use the `MultiSelect` at the top to select the prompt parameters you're interested in. 
For instance, in `basic_comparison.cforge` in `examples/`, we can plot length of response by `{game}` across LLMs:

<img width="555" alt="Screen Shot 2023-05-22 at 1 02 02 PM" src="https://github.com/ianarawjo/ChainForge/assets/5251713/ced3f4a8-1df7-4691-9cb3-52bf82508c8d">

Or maybe we don't care about the `{game}` parameter, only the overall length of responses per LLM to get a sense of the response complexity. 
We can plot this by simply removing the parameter:

<img width="553" alt="Screen Shot 2023-05-22 at 1 02 07 PM" src="https://github.com/ianarawjo/ChainForge/assets/5251713/984fd733-1926-41c5-9a92-dc13d3cf5dec">

> **Note**
> Currently, you can only attach Evaluator nodes to Vis Nodes. This may change in the future.

**Currently supported plots by type of evaluation results, number of LLMs, and number of prompt parameters:**
 - Numeric, one LLM, one prompt parameter: Simple box-and-whiskers plot
 - Numeric, multiple LLMs, no prompt parameters: Simple box-and-whiskers plot, where categories are LLMs
 - Numeric, multiple LLMs, one prompt parameter: Box-and-whiskers plot grouped by LLM
 - Numeric, one LLM, two prompt parameters: 3D scatterplot (_**Experimental**_)
 - Boolean, multiple LLMs, no prompt parameters: Stacked histogram of true/false values per LLM
 - Boolean, multiple LLMs, one prompt parameter: Stacked histogram of `true` values per LLM, grouped by parameter value
 - Dictionary (key-metric), one LLM, one prompt parameter: Parallel coordinates plot
 - _Dictionary (key-metric), multiple LLMs: Currently unsupported. 
   To complare across LLMs with multiple metrics, currently just remove all but one LLM from the upstream prompt node to select what LLM you wish to display._

------------------
## Exporting / Importing flows

Share your evaluation flows with others.
You can export your flow as a `cforge` file (JSON) by clicking the `Export` button at the top of the screen.
Import flows via the `Import` button. 

> **Note**
> The exported file contains the entire cache of LLM responses, available in the `cache/` directory where the `chainforge` package is installed. 
> When you import a flow, these cache files are re-saved to the importing user's local `cache/` directory. This saves money and time:
> LLMs don't need to be re-queried by the user importing your flow. If for some reason you wish to delete cache'd responses, remove the `cache` folder in the package directory.

