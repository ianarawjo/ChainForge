# ⛓️🛠️ ChainForge
**An open-source visual programming environment for battle-testing prompts for LLMs.**

ChainForge is a data flow prompt engineering tool for testing and evaluating prompts (and eventually, prompt chains) for LLMs. Think of ChainForge like an exploration tool where you can 'sketch' prompt ideas and test them quickly and effectively. Like Jupyter Notebooks were good for early-stage exploration, ChainForge is geared towards early-stage, quick-and-dirty exploration of prompts and response quality that goes beyond ad-hoc chatting with individual LLMs. 

ChainForge is built on [ReactFlow](https://reactflow.dev) and is in active development.

# Features

A key goal of ChainForge is facilitating **comparison** and **evaluation** of prompts and models, and (in the near future) prompt chains. These comparison features are:

- **Prompt permutations**: Setup a prompt template and feed it variations of input variables. ChainForge will prompt all selected LLMs with all possible permutations of the input prompt, so that you can get a better sense of prompt quality.
- **Evaluation nodes**: Probe points in a response chain and test them for some desired behavior. Initially, Python script based. 
- **Visualize the difference between prompts**: Visualize evaluation outputs, on plots like box-and-whisker and 3D scatterplots. Easily:
  - **Compare across prompts**: Choose the best set of prompts that maximizes your eval target metrics (eg, lowest code error rate).
  - **Compare across models**: Compare responses for every prompt across models. In the future, detect where models "diverge" --i.e., produce radically different outputs at a point in a chain.
  - **Compare across responses**: Run an evaluator over all N responses generated for each prompt, to measure factors like variability or parseability (e.g., how many code outputs pass a basic smell test?).

ChainForge is meant to be general-purpose, and is not developed for a specific API or LLM back-end. 

### Sharing prompt chains

All ChainForge node graphs are importable/exportable as JSON specs. You can freely share prompt chains you develop (alongside any custom analysis code), whether to the public or within your organization. 

## Developers

ChainForge is developed by research scientists at Harvard University in the [Harvard HCI](https://hci.seas.harvard.edu) group:
- [Ian Arawjo](http://ianarawjo.com/index.html)
- [Priyan Vaithilingam](https://priyan.info)
- [Elena Glassman]()

It came about by necessity in the course of developing another, higher-level interface for evaluating LLM outputs. We provide ongoing releases of this tool in the hopes that others find it useful for their projects, but we make no claims about its robustness or future maintenance.

## Inspiration and Links

This project was inspired by own our use case, but also derives insights from two related (closed-source) research projects, both led by [Sherry Wu](https://www.cs.cmu.edu/~sherryw/):
- "PromptChainer: Chaining Large Language Model Prompts through Visual Programming" (Wu et al., CHI ’22 LBW) [Video](https://www.youtube.com/watch?v=p6MA8q19uo0)
- "AI Chains: Transparent and Controllable Human-AI Interaction by Chaining Large Language Model Prompts" (Wu et al., CHI ’22)

This project differs from the above in that it focuses on evaluation across responses, prompt variations, and models. Also unlike these projects, this project aspires to be open-source and remain in the public domain, as our ultimate goal is integration into other tools for the systematic evaluation and auditing of LLMs. We hope to help others who are developing prompt-analysis flows in LLMs, or otherwise auditing LLM outputs. 

## Future Planned Features

- **AI assistance for prompt engineering**: Spur creative ideas and quickly iterate on variations of prompts through interaction with GPT4.
- **Compare fine-tuned to base models**: Beyond comparing between different models like Alpaca and ChatGPT, we want to support comparison between versions of the same model (e.g., a base model and a fine-tuned one). Did your fine-tuning result in any 'breaking changes' elsewhere? We are building infrastructure to help you detect where.  
- **Export prompt chains to well-known APIs**: In the future, export a chain (in part) to a programming API like LangChain.
- **Compare across chains**: If a system prompt, or another ‘shared prompt’, is used *across* chains C1 C2 etc, how does changing it affect all downstream events?

## License

ChainForge is released under the MIT License.

## How to collaborate?

We are looking for open-source collaborators. The best way to do this, at the moment, is simply to implement the requested feature / bug fix and submit a Pull Request. If you want to report a bug or request a feature, open an Issue. 
