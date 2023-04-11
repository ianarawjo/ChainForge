# ⛓️🛠️ ChainForge
**An open-source, extensible visual programming environment for forging prompt chains for LLMs.**

ChainForge is a data flow programming environment for testing and evaluating "prompt chains" for LLMs. Our goal is to provide a basic, open-source visual programming tool that developers can use to battle-test prompts against LLM responses.

ChainForge is built on [ReactFlow](https://reactflow.dev) and is in active development.

# Features

A key goal of ChainForge is facilitating **comparison** and **evaluation** of prompts, prompt chains, and chain assemblages. These comparison features are:

- **Evaluation nodes**: Probe points in a chain and test them for some desired behavior. Python script based.
- **Compare across responses**: LLMs can generate N responses given temperature T, even if all prompts are fixed. Have metrics/vis tools to help user measure the ‘stability’ of responses given a prompt across N responses, for temperature T. (diffs?)
- **Compare across prompts**: “Fix” a run of a chain, then edit an upstream prompt to visualize downstream changes (diffs?). Can compare between multiple (N) variations of prompts, and choose the best set of prompts that maximizes your eval target metrics (eg, lowest code error rate).
- **Compare across chains**: If a system prompt, or a ‘shared prompt’, is used in Chains C1 C2 etc, how does changing it affect all chains?
- **Compare across models**: Given a chain or chain assemblage (C chains, all used by your app/system), compare responses across models. This should measure both *intra-response perturbations* (fluctuations within each model) and *inter-response* perturbations. Can detect where models “diverge” in the large —i.e., produce radically different outputs at a point in a chain.

ChainForge is meant to be general-purpose, and is not developed for a specific API or LLM back-end. 

### Example: Divergence detectors

In ChainForge, we built ways to help you **visualize the difference between LLMs for the same prompt.** In other words, you can compare responses across different models for the same prompt chain. This helps developers to, for instance:
- understand what model might be best for their specific task (choose the right model)
- guard against over-engineering a prompt chain for a single model (avoid over-engineering)
- visualize the differences between models (compare model outputs)

Beyond comparing between different models like Alpaca and ChatGPT, this feature is also useful to compare between versions of the same model (e.g., a base model and a fine-tuned one). Did your fine-tuning result in any 'breaking changes' elsewhere? ChainForge divergences can help you can detect where. 

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

This project goes beyond the above in that it facilitates comparisons and evaluation across responses, prompts, and models. Also unlike these projects, this project aspires to be open-source and remain in the public domain, as our ultimate goal is integration into other tools for the systematic evaluation and auditing of LLMs. We hope to help others who are developing prompt-analysis flows in LLMs, or otherwise auditing LLM outputs. 

## License

ChainForge is released under the MIT License.

## How to collaborate?

We are looking for open-source collaborators. The best way to do this, at the moment, is simply to implement the requested feature / bug fix and submit a Pull Request. If you want to report a bug or request a feature, open an Issue. 
