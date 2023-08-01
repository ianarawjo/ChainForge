# Node and Features Guide

An explanation of all nodes and features currently available in the alpha version of ChainForge. 

## Prompt Nodes and Prompt Templating

### Set a prompt and number of responses requested 
Below is a Prompt Node (right) with a TextFields node as input data. You can write your prompt in the text field at the top. Use `{}` template hooks to declare input variables, which you can attach to other nodes. For example, here is a prompt node with one input parameter:

<img width="702" alt="Screen Shot 2023-05-22 at 12 40 12 PM" src="https://github.com/ianarawjo/ChainForge/assets/5251713/520206b7-6ed5-43fa-947e-bb89b889be9a">

You can increase `Num responses per prompt` to sample more than 1 response for every prompt to every LLM.

### Set LLMs to query

With ChainForge, you can query one or multiple LLMs simulatenously with the same prompts. Click `Add +` in the drop-down list to add an LLM, or click the Trash icon to remove one. GPT3.5 (ChatGPT) is added by default. 

See the `INSTALL_GUIDE.md` for currently supported LLMs.

### Prompt Templating in ChainForge 

ChainForge uses single braces `{var}` for variables. You can escape braces with `\`; for instance, `function foo() \{ return true; \}` in a TextFields
node will generate a prompt `function foo() { return true; }`. 

> **Warning**
> All of your prompt variables should have unique names across an entire flow. If you use duplicate names, behavior is not guaranteed. 

ChainForge includes power features for generating tons of permutations of prompts via template variables. 
If you have multiple template variables input to a prompt node, ChainForge will calculate the _cross product_ of all inputs: all combinations of all input variables. 
For instance, for the prompt `What {time} did {game} come out in the US?` where `time` could be `year` or `month`, and `game` could be one of 3 games `Pokemon Blue`, `Kirby's Dream Land`, and `Ocarina of Time`, we have `2 x 3 = 6` combinations:

 - `What year did Pokemon Blue come out in the US?`
 - `What month did Pokemon Blue come out in the US?`
 - `What year did Kirby's Dream Land come out in the US?`
 - `What month did Kirby's Dream Land come out in the US?`
 - `What year did`... etc

There is an exception: if multiple inputs are the columns of Tabular Data nodes, then those variables will _carry together_. 
This lets you pass associated information, such as a city and a country, defined in rows of a table. 
For more information, see the Tabular Data section below. 

Finally, you may use a special hashtag `#` before a template variable name 
to denote _implicit_ template variables that should be filled
_using prior variable and metavariable history associated with the input to that node_. 
This is best explained with a practical example:

<img width="1439" alt="Screen Shot 2023-08-01 at 11 30 01 AM" src="https://github.com/ianarawjo/ChainForge/assets/5251713/107936a3-9dde-4927-9411-f899ca7fb28f">

Here, I have a Prompt Node with an _explicit_ template `{question}`. Each input (value in a table row) 
has an associated metavariable, the value of the column `Expected`. I can use this value in any later prompt templates via `{#Expected}`,
even if they are further down a prompt chain. Note that we could've also used `{#question}` in the LLM Scorer here
to use the original value of `{question}` associated with each response into our LLM Scorer prompt.

See the Code Evaluator section below for more details on what `vars` and `metavars` are. 

### Query the selected LLMs with all prompts

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
## Tabular Data Node

Tabular data provides an easy way to enter associated prompt parameters or import existing datasets and benchmarks. A typical use case is **ground truth evaluation**, where we have some inputs to a prompt, and an "ideal" or expected answer:

<img width="1377" alt="Screen Shot 2023-06-10 at 2 23 13 PM" src="https://github.com/ianarawjo/ChainForge/assets/5251713/e3dd6941-47d4-4eee-b8b1-d9007f7aae15">

Here, we see **variables `{first}`, `{last}`, and `{invention}` "carry together" when filling the prompt template**: ChainForge knows they are all associated with one another, connected via the row. Thus, it constructs 4 prompts from the input parameters. This is different than using separate Textfields nodes as input, which will calculate the cross product of all inputs (as described in Prompt Node above).

You can press Import data to import files with format `jsonl`, `xlsx`, and `csv`. 

> **Note**
> Excel and CSV files must have a header row with column names.

To insert a row or delete one, right-click on a row cell:

<img width="482" alt="tabular-data-row-dropdown" src="https://github.com/ianarawjo/ChainForge/assets/5251713/2290cda2-fa6c-48fa-84c3-80dac95770fa">

To insert a column, rename or delete one, click on the column `...` button:

<img width="468" alt="tabular-data-col-dropdown" src="https://github.com/ianarawjo/ChainForge/assets/5251713/2c107d19-a15f-428c-8326-25a0cc07468a">

You can also change cell text by simply editing it.

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
## Code Evaluator Node

Score responses by writing an evaluate function in Python or JavaScript. This section will refer to Python evaluator, but the JavaScript one is similar. 

To use a code evaluator, you must declare a `def evaluate(response)` function which will be called by ChainForge for every response in the input.
You can add other helper functions or `import` statements as well.

For instance, here is a basic evaluator to check the length of the response:

<img width="355" alt="Screen Shot 2023-05-22 at 1 50 13 PM" src="https://github.com/ianarawjo/ChainForge/assets/5251713/bfc0b5e5-92a9-46d2-9df6-5792843466e1">

The `response` argument is a `ResponseInfo` object. From the source code:
```python
class ResponseInfo:
    """Stores info about a single LLM response. Passed to evaluator functions."""
    text: str  # The text of the LLM response
    prompt: str  # The text of the prompt using to query the LLM
    var: dict  # A dictionary of arguments that filled in the prompt template used to generate the final prompt
    meta: dict  # A dictionary of metadata ('metavars') that is 'carried alongside' data used to generate the prompt
    llm: str  # The name of the LLM queried (the nickname in ChainForge)

    def __str__(self):
        return self.text
```
Use `var` to get access to values that were input into a prompt template. For instance, suppose we have the prompt:

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

A simpler solution, however, may be to use a Tabular Data node and `response.meta` with the year of the game's release as a column of the table. For instance, here is an analogous situation of comparing the LLM's response to the 'ground truth' for math problem questions:

<img width="1770" alt="Screen Shot 2023-06-11 at 11 51 28 AM" src="https://github.com/ianarawjo/ChainForge/assets/5251713/3a038fa6-46af-42d8-ac82-e94f7c239b10">

We use `response.meta['Expected']` to get the value of the table associated with the inputs. Notice that "Expected" _was not an input parameter to the prompt_. Instead, "Expected" is associated with a prompt input variable `question` (which you could access using `response.var['question']`). Using `meta` (short for metadata) like this can be quite useful when writing more complex evaluations.

If you're curious about the response format or need to debug your evaluations, Evaluator Nodes expose `print` output within the `evaluate` function, so you can use Python `print` or `raise Exception` functions to get feedback:

<img width="377" alt="Screen Shot 2023-06-10 at 8 29 38 PM" src="https://github.com/ianarawjo/ChainForge/assets/5251713/6863c427-ef59-4e8d-92c3-fe8e92ad7415">

### Return values of Evaluator Nodes must currently be of the following types:
 - Numeric
 - Boolean (`true` or `false`)
 - Dictionaries with numeric data (key-value pairs of type `{<str>: <number>}`

If you return a dictionary with more than one key, metrics will be plotted in a parallel coordinates plot. For example, for four keys in the dictionary:

<img width="473" alt="Screen Shot 2023-05-18 at 11 10 10 AM" src="https://github.com/ianarawjo/ChainForge/assets/5251713/f08ef183-782e-4e2c-9402-f2494715c92d">

You can also use a single-key dictionary to label the metric axis of a Vis Node:

<img width="982" alt="Screen Shot 2023-05-22 at 12 57 02 PM" src="https://github.com/ianarawjo/ChainForge/assets/5251713/31581d14-1cf2-4e3d-8755-fcb812937e89">

------------------
## LLM Scorer Node

An LLM Scorer uses a single model to score responses (by default GPT-4 at temperature 0). You must
write a scoring prompt that includes the expected format of output (e.g., "Reply true or false."). The
text of the input will be pasted directly below your prompt, in triple-` tags. 

For instance, here is GPT-4 scoring whether Falcon-7b's responses to math problems are true:

<img width="1439" alt="Screen Shot 2023-08-01 at 11 30 01 AM" src="https://github.com/ianarawjo/ChainForge/assets/5251713/2fc1e428-3ac0-4c7b-9454-8edaaa3381f0">

We've used an implicit template variable, `{#Expected}`, to use the metavariable "Expected" associate with each response (from the table to the left). 

> **Note**
> You can also use LLMs to score responses through prompt chaining. However, this requires running outputs through a code evaluator node. 
> The LLM Scorer simplifies the process by attaching LLM scores directly as evaluation results, without modifying what LLM generated the response. 

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

