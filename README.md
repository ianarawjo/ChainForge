# ⛓️🛠️ ChainForge
**An open-source visual programming environment for battle-testing prompts to LLMs.**

<img width="1615" alt="Screen Shot 2023-05-17 at 2 45 17 PM" src="https://github.com/ianarawjo/ChainForge/assets/5251713/96aecea7-cf05-4064-8f83-20a524449af7">

ChainForge is a data flow prompt engineering environment for analyzing and evaluating LLM responses. Like Jupyter Notebooks are geared towards early-stage exploration, ChainForge is geared towards early-stage, quick-and-dirty exploration of prompts and response quality that goes beyond ad-hoc chatting with individual LLMs. With CF, you can: 
 - Query multiple LLMs at once to sketch prompt ideas and test variations quickly and effectively. 
 - Compare response quality across prompt variations and across models to choose the best prompt and model for your use case. 
 - Setup an evaluation metric (scoring function) and immediately visualize results across prompts, prompt parameters, and models. 

**This is an open alpha of Chainforge.** We currently support models GPT3.5, GPT4, Claude, and Alpaca 7B (through [Dalai](https://github.com/cocktailpeanut/dalai)) at default settings. Try it and let us know what you think! :) 

ChainForge is built on [ReactFlow](https://reactflow.dev) and [Flask](https://flask.palletsprojects.com/en/2.3.x/).

# Installation

To get started with Chainforge alpha, see the [Installation Guide](https://github.com/ianarawjo/ChainForge/blob/main/GUIDE.md). In the near future, we will upload to PyPI as an official package.

## Example evaluation flows

We've prepared a couple Example flows to give you a sense of what's possible with Chainforge. 
Import them, then:
 - Run any Prompt node(s) to query the LLM(s),
 - Run any Evaluator nodes to score responses.

Note that right now, **exporting a CF flow does not save cache'd responses.**

# Features

A key goal of ChainForge is facilitating **comparison** and **evaluation** of prompts and models, and (in the near future) prompt chains. Basic features are:
- **Prompt permutations**: Setup a prompt template and feed it variations of input variables. ChainForge will prompt all selected LLMs with all possible permutations of the input prompt, so that you can get a better sense of prompt quality. You can also chain prompt templates at arbitrary depth (e.g., to compare templates).
- **Evaluation nodes**: Probe LLM responses in a chain and test them (classically) for some desired behavior. At a basic level, this is Python script based. We plan to add preset evaluator nodes for common use cases in the near future (e.g., name-entity recognition). Note that you can also chain LLM responses into prompt templates to help evaluate outputs cheaply before more extensive evaluation methods.
- **Visualization nodes**: Visualize evaluation results on plots like box-and-whisker and 3D scatterplots.

Taken together, these three features let you easily:
  - **Compare across prompts and prompt parameters**: Choose the best set of prompts that maximizes your eval target metrics (e.g., lowest code error rate). Or, see how changing parameters in a prompt template affects the quality of responses.
  - **Compare across models**: Compare responses for every prompt across models. 

# Development

ChainForge is being developed by research scientists at Harvard University in the [Harvard HCI](https://hci.seas.harvard.edu) group:
- [Ian Arawjo](http://ianarawjo.com/index.html)
- [Priyan Vaithilingam](https://priyan.info)
- [Elena Glassman](https://glassmanlab.seas.harvard.edu/glassman.html)

We provide ongoing releases of this tool in the hopes that others find it useful for their projects.

## Future Planned Features

- **Model settings**: Change settings for individual models, so one can test across the same model with different settings
- **Compare across response batches**: Run an evaluator over all N responses generated for each prompt, to measure factors like variability or parseability (e.g., how many code outputs pass a basic smell test?)
- **System prompts**: Ability to change the system prompt for models that support it (e.g., ChatGPT). Try out different system prompts and compare response quality.
- **Collapse nodes**: Nodes should be collapseable, to save screen space.
- **LMQL and Microsoft guidance nodes**: Support for prompt pipelines that involve LMQL and {{guidance}} code, esp. inspecting masked response variables. 
- **AI assistance for prompt engineering**: Spur creative ideas and quickly iterate on variations of prompts through interaction with GPT4.
- **Compare fine-tuned to base models**: Beyond comparing between different models like Alpaca and ChatGPT, support comparison between versions of the same model (e.g., a base model and a fine-tuned one). Helper users detect where fine-tuning resulted in any 'breaking changes' elsewhere. 
- **Export to code**: In the future, export prompt and (potentially) chains using a programming API like LangChain.
- **Dark mode**: A dark mode theme
- **Compare across chains**: If a prompt P is used *across* chains C1 C2 etc, how does changing it affect all downstream events?

See a feature you'd like that isn't here? Open an [Issue](https://github.com/ianarawjo/ChainForge/issues).

## Inspiration and Links

ChainForge is meant to be general-purpose, and is not developed for a specific API or LLM back-end. Our ultimate goal is integration into other tools for the systematic evaluation and auditing of LLMs. We hope to help others who are developing prompt-analysis flows in LLMs, or otherwise auditing LLM outputs. This project was inspired by own our use case, but also shares some comraderie with two related (closed-source) research projects, both led by [Sherry Wu](https://www.cs.cmu.edu/~sherryw/):
- "PromptChainer: Chaining Large Language Model Prompts through Visual Programming" (Wu et al., CHI ’22 LBW) [Video](https://www.youtube.com/watch?v=p6MA8q19uo0)
- "AI Chains: Transparent and Controllable Human-AI Interaction by Chaining Large Language Model Prompts" (Wu et al., CHI ’22)

Unlike these projects, we are focusing on supporting evaluation across prompts, prompt parameters, and models.

## How to collaborate?

We are looking for open-source collaborators. The best way to do this, at the moment, is simply to implement the requested feature / bug fix and submit a Pull Request. If you want to report a bug or request a feature, open an [Issue](https://github.com/ianarawjo/ChainForge/issues). 

# License

ChainForge is released under the MIT License.
