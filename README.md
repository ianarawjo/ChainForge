# ⛓️🛠️ ChainForge
**An open-source visual programming environment for battle-testing prompts to LLMs.**

<img width="1615" alt="Screen Shot 2023-05-17 at 2 45 17 PM" src="https://github.com/ianarawjo/ChainForge/assets/5251713/96aecea7-cf05-4064-8f83-20a524449af7">

ChainForge is a data flow prompt engineering tool for testing and evaluating prompts (and eventually, prompt chains) for LLMs. Like Jupyter Notebooks are good for early-stage exploration, ChainForge is geared towards early-stage, quick-and-dirty exploration of prompts and response quality that goes beyond ad-hoc chatting with individual LLMs. 'Sketch' prompt ideas and test variations quickly and effectively. Compare response quality across prompt variations and across models to choose the best prompt and model for your use case. 

**This is an open alpha of Chainforge.** We currently support models GPT3.5, GPT4, Claude, and Alpaca 7B (through [Dalai](https://github.com/cocktailpeanut/dalai)) at default settings. Try it and let us know what you think! :) 

ChainForge is built on [ReactFlow](https://reactflow.dev) and [Flask](https://flask.palletsprojects.com/en/2.3.x/).

# Features

A key goal of ChainForge is facilitating **comparison** and **evaluation** of prompts and models, and (in the near future) prompt chains. Basic features are:
- **Prompt permutations**: Setup a prompt template and feed it variations of input variables. ChainForge will prompt all selected LLMs with all possible permutations of the input prompt, so that you can get a better sense of prompt quality. You can also chain prompt templates at arbitrary depth (e.g., to compare templates).
- **Evaluation nodes**: Probe LLM responses in a chain and test them (classically) for some desired behavior. At a basic level, this is Python script based. We plan to add preset evaluator nodes for common use cases in the near future (e.g., name-entity recognition). Note that you can also chain LLM responses into prompt templates to help evaluate outputs cheaply before more extensive evaluation methods.
- **Visualization nodes**: Visualize evaluation results on plots like box-and-whisker and 3D scatterplots.

Taken together, these three features let you easily:
  - **Compare across prompts**: Choose the best set of prompts that maximizes your eval target metrics (eg, lowest code error rate).
  - **Compare across models**: Compare responses for every prompt across models. In the future, detect where models "diverge" --i.e., produce radically different outputs at a point in a chain.
  - **Compare across responses**: Run an evaluator over all N responses generated for each prompt, to measure factors like variability or parseability (e.g., how many code outputs pass a basic smell test?).
  
# Installation

To get started, currently see the `CONTRIBUTOR_GUIDE.md`. Below are the planned installation steps (which are not yet active): 

>
> To install, use `pip`. From the command line:
> 
> ```
> pip install chainforge
> ```
> To run, type:
> ```
> chainforge serve
> ```
> This spins up two local servers: a React server through npm, and a Python backend, powered by Flask. For more options, such as port numbers, type `chainforge --help`.

## Example: Test LLM robustness to prompt injection

> ...

# Development

ChainForge is developed by research scientists at Harvard University in the [Harvard HCI](https://hci.seas.harvard.edu) group:
- [Ian Arawjo](http://ianarawjo.com/index.html)
- [Priyan Vaithilingam](https://priyan.info)
- [Elena Glassman]()

We provide ongoing releases of this tool in the hopes that others find it useful for their projects.

## Future Planned Features

- **Collapse nodes**: Nodes should be collapseable, to save screen space.
- **LMQL node**: Support for prompt pipelines that involve LMQL code, esp. inspecting masked response variables. 
- **AI assistance for prompt engineering**: Spur creative ideas and quickly iterate on variations of prompts through interaction with GPT4.
- **Compare fine-tuned to base models**: Beyond comparing between different models like Alpaca and ChatGPT, support comparison between versions of the same model (e.g., a base model and a fine-tuned one). Helper users detect where fine-tuning resulted in any 'breaking changes' elsewhere. 
- **Export prompt chains to well-known APIs**: In the future, export a chain (in part) to a programming API like LangChain.
- **Dark mode**: A dark mode theme
- **Compare across chains**: If a system prompt, or another ‘shared prompt’, is used *across* chains C1 C2 etc, how does changing it affect all downstream events?

## Inspiration and Links

ChainForge is meant to be general-purpose, and is not developed for a specific API or LLM back-end. 
This project was inspired by own our use case, but also derives insights from two related (closed-source) research projects, both led by [Sherry Wu](https://www.cs.cmu.edu/~sherryw/):
- "PromptChainer: Chaining Large Language Model Prompts through Visual Programming" (Wu et al., CHI ’22 LBW) [Video](https://www.youtube.com/watch?v=p6MA8q19uo0)
- "AI Chains: Transparent and Controllable Human-AI Interaction by Chaining Large Language Model Prompts" (Wu et al., CHI ’22)

Unlike these projects, we are focusing on supporting evaluation across responses, prompt variations, and models. 

This project aspires to be open-source and remain in the public domain, as our ultimate goal is integration into other tools for the systematic evaluation and auditing of LLMs. We hope to help others who are developing prompt-analysis flows in LLMs, or otherwise auditing LLM outputs. 

## How to collaborate?

We are looking for open-source collaborators. The best way to do this, at the moment, is simply to implement the requested feature / bug fix and submit a Pull Request. If you want to report a bug or request a feature, open an Issue. 

# License

ChainForge is released under the MIT License.
