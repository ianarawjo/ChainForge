# ⛓️🛠️ ChainForge
**An open-source visual programming environment for battle-testing prompts to LLMs.**

<img width="1517" alt="banner" src="https://github.com/ianarawjo/ChainForge/assets/5251713/570879ef-ef8a-4e00-b37c-b49bc3c1a370">

ChainForge is a data flow prompt engineering environment for analyzing and evaluating LLM responses. It is geared towards early-stage, quick-and-dirty exploration of prompts and response quality that goes beyond ad-hoc chatting with individual LLMs. With ChainForge, you can: 
 - Query multiple LLMs at once to test prompt ideas and variations quickly and effectively. 
 - Compare response quality across prompt permutations, across models, and across model settings to choose the best prompt and model for your use case. 
 - Setup an evaluation metric (scoring function) and immediately visualize results across prompts, prompt parameters, models, and model settings.

ChainForge comes with a number of example evaluation flows to give you a sense of what's possible, including 188 example flows generated from benchmarks in OpenAI evals.

# Try it @ https://chainforge.ai/play/ 

**This is an open beta of Chainforge.** Functionality is powerful but limited. We currently support OpenAI models GPT3.5 and GPT4, HuggingFace models on the Inference API, Anthropic's Claude, Google PaLM2, Azure OpenAI endpoints, and [Dalai](https://github.com/cocktailpeanut/dalai)-hosted models Alpaca and Llama. You can change the exact model and individual model settings. Visualization nodes support numeric and boolean evaluation metrics. Try it and let us know what you think! :)

ChainForge is built on [ReactFlow](https://reactflow.dev) and [Flask](https://flask.palletsprojects.com/en/2.3.x/).

# Installation (local machine)

The web version of ChainForge (https://chainforge.ai/play/) has a limited feature set. In a locally installed version you can load API keys automatically from environment variables, write Python code to evaluate LLM responses, or query locally-run Alpaca/Llama models hosted via Dalai.

To install Chainforge on your machine, make sure you have Python 3.8 or higher, then run

```bash
pip install chainforge
```

Once installed, do

```bash
chainforge serve
```

Open [localhost:8000](http://localhost:8000/) in a Google Chrome or Firefox browser.

You can set your API keys by clicking the Settings icon in the top-right corner. If you prefer to not worry about this everytime you open ChainForge, we recommend that save your OpenAI, Anthropic, and/or Google PaLM API keys to your local environment. For more details, see the [Installation Guide](https://github.com/ianarawjo/ChainForge/blob/main/INSTALL_GUIDE.md).

# Example evaluation flows

We've prepared a couple example flows to give you a sense of what's possible with Chainforge.
Click the "Example Flows" button on the top-right corner and select one. Here is a basic comparison example, plotting the length of responses across different models and arguments for the prompt parameter `{game}`:

<img width="1593" alt="basic-compare" src="https://github.com/ianarawjo/ChainForge/assets/5251713/43c87ab7-aabd-41ba-8d9b-e7e9ebe25c75">

You can also conduct **ground truth evaluations** using Tabular Data nodes. For instance, we can compare each LLM's ability to answer math problems by comparing each response to the expected answer:

<img width="1775" alt="Screen Shot 2023-07-04 at 9 21 50 AM" src="https://github.com/ianarawjo/ChainForge/assets/5251713/6d842f7a-f747-44f9-b317-95bec73653c5">

For finer details about the features of available nodes, check out the [Node Guide](https://github.com/ianarawjo/ChainForge/blob/main/GUIDE.md).

# Features

A key goal of ChainForge is facilitating **comparison** and **evaluation** of prompts and models. Basic features are:
- **Prompt permutations**: Setup a prompt template and feed it variations of input variables. ChainForge will prompt all selected LLMs with all possible permutations of the input prompt, so that you can get a better sense of prompt quality. You can also chain prompt templates at arbitrary depth (e.g., to compare templates).
- **Model settings**: Change the settings of supported models, and compare across settings. For instance, you can measure the impact of a system message on ChatGPT by adding several ChatGPT models, changing individual settings, and nicknaming each one. ChainForge will send out queries to each version of the model.
- **Evaluation nodes**: Probe LLM responses in a chain and test them (classically) for some desired behavior. At a basic level, this is Python script based. We plan to add preset evaluator nodes for common use cases in the near future (e.g., name-entity recognition). Note that you can also chain LLM responses into prompt templates to help evaluate outputs cheaply before more extensive evaluation methods.
- **Visualization nodes**: Visualize evaluation results on plots like grouped box-and-whisker (for numeric metrics) and histograms (for boolean metrics). Currently we only support numeric and boolean metrics. We aim to provide users more control and options for plotting in the future.

Taken together, these features let you easily:
  - **Compare across prompts and prompt parameters**: Choose the best set of prompts that maximizes your eval target metrics (e.g., lowest code error rate). Or, see how changing parameters in a prompt template affects the quality of responses.
  - **Compare across models**: Compare responses for every prompt across models and different model settings.

We've also found that some users simply want to use ChainForge to make tons of parametrized queries to LLMs (e.g., chaining prompt templates into prompt templates), possibly score them, and then output the results to a spreadsheet (Excel `xlsx`). To do this, attach an Inspect node to the output of a Prompt node and click `Export Data`.

For more specific details, see the [User Guide](https://github.com/ianarawjo/ChainForge/blob/main/GUIDE.md).

# Share with others

The web version of ChainForge (https://chainforge.ai/play/) includes a Share button. 

Simply click Share to generate a unique link for your flow and copy it to your clipboard:

![ezgif-2-a4d8048bba](https://github.com/ianarawjo/ChainForge/assets/5251713/1c69900b-5a0f-4055-bbd3-ea191e93ecde)

For instance, here's a experiment I made that tries to get an LLM to reveal a secret key: https://chainforge.ai/play/?f=28puvwc788bog

> **Note**
> To prevent abuse, you can only share up to 10 flows at a time, and each flow must be <5MB after compression.
> If you share more than 10 flows, the oldest link will break, so make sure to always Export important flows to `cforge` files,
> and use Share to only pass data ephemerally.

----------------------------------

# Development

ChainForge was created by [Ian Arawjo](http://ianarawjo.com/index.html), a postdoctoral scholar in Harvard HCI's [Glassman Lab](http://glassmanlab.seas.harvard.edu/) with support from the Harvard HCI community, especially PhD student [Priyan Vaithilingam](https://priyan.info).

This work was partially funded by the NSF grant IIS-2107391. Any opinions, findings, and conclusions or recommendations expressed in this material are those of the author(s) and do not necessarily reflect the views of the National Science Foundation.

We provide ongoing releases of this tool in the hopes that others find it useful for their projects.

## Future Planned Features

Highest priority:
- **Improved vis and inspect nodes**: Better UX and more features, such as collapsing variable groups in response inspectors and more control over visualizations displayed in vis nodes beyond the default

Medium-to-low priority:
- **LMQL and Microsoft guidance nodes**: Support for prompt pipelines that involve LMQL and {{guidance}} code, esp. inspecting masked response variables. 
- **AI assistance for prompt engineering**: Spur creative ideas and quickly iterate on variations of prompts through interaction with GPT4.
- **Compare fine-tuned to base models**: Beyond comparing between different models like Alpaca and ChatGPT, support comparison between versions of the same model (e.g., a base model and a fine-tuned one). Helper users detect where fine-tuning resulted in any 'breaking changes' elsewhere. 
- **Export to code**: In the future, export prompt and (potentially) chains using a programming API like LangChain.
- **Compare across response batches**: Run an evaluator over all N responses generated for each prompt, to measure factors like variability or parseability (e.g., how many code outputs pass a basic smell test?)
- **Collapse nodes**: Nodes should be collapseable, to save screen space.
- **Dark mode**: A dark mode theme

See a feature you'd like that isn't here? Open an [Issue](https://github.com/ianarawjo/ChainForge/issues).

## Inspiration and Links

ChainForge is meant to be general-purpose, and is not developed for a specific API or LLM back-end. Our ultimate goal is integration into other tools for the systematic evaluation and auditing of LLMs. We hope to help others who are developing prompt-analysis flows in LLMs, or otherwise auditing LLM outputs. This project was inspired by own our use case, but also shares some comraderie with two related (closed-source) research projects, both led by [Sherry Wu](https://www.cs.cmu.edu/~sherryw/):
- "PromptChainer: Chaining Large Language Model Prompts through Visual Programming" (Wu et al., CHI ’22 LBW) [Video](https://www.youtube.com/watch?v=p6MA8q19uo0)
- "AI Chains: Transparent and Controllable Human-AI Interaction by Chaining Large Language Model Prompts" (Wu et al., CHI ’22)

Unlike these projects, we are focusing on supporting evaluation across prompts, prompt parameters, and models.

## How to collaborate?

We are looking for open-source collaborators. The best way to collaborate, at the moment, is simply to implement the requested feature / bug fix and submit a Pull Request. If you want to report a bug or request a feature, open an [Issue](https://github.com/ianarawjo/ChainForge/issues). 

_(If you are an investor or funder, send us a message via email.)_

# License

ChainForge is released under the MIT License.
