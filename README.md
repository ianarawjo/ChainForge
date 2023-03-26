# ChainForge
**An open-source, extensible visual programming environment for developing prompt-analysis chains for LLMs.**

ChainForge is a data flow programming environment for visualizing and developing "prompt chains" for LLMs. It integrates with Python code as its backend, such as LangChain, for calling LLMs and performing analysis on responses. 

Our goal is to provide a basic, open-source visual programming architecture around prompt chaining that developers can build upon for their specific use cases. As such, we focus on extensibility and simplicity. 

ChainForge is built on [ReactFlow](https://reactflow.dev) and is in active development.

# Features

### Divergence detectors: Comparing between models

In ChainForge, we built ways to help you **visualize the difference between LLMs for the same prompt.** In other words, you can compare responses across different models for the same prompt chain. This helps developers to, for instance:
- understand what model might be best for their specific task (choose the right model)
- guard against over-engineering a prompt chain for a single model (avoid over-engineering)
- visualize the differences between models (compare model outputs)

Beyond comparing between different models like Alpaca and ChatGPT, this feature is also useful to compare between versions of the same model (e.g., a base model and a fine-tuned one). Did your fine-tuning result in any 'breaking changes' elsewhere? ChainForge divergences can help you can detect where. 

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

Unlike these projects, this project aspires to be open-source and remain in the public domain, as our ultimate goal is integration into other tools for the systematic evaluation and auditing of LLMs. We hope to help others who are developing prompt-analysis flows in LLMs, or otherwise auditing LLM outputs. 

## License

ChainForge is released under the MIT License.
