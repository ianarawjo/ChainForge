# ⛓️🛠️ ChainForge 

**An open-source visual environment for battle-testing prompts to LLMs.** [![Mentioned in Awesome Chainforge](https://awesome.re/mentioned-badge.svg)](https://github.com/loloMD/awesome_chainforge)

<img width="1517" alt="banner" src="https://github.com/ianarawjo/ChainForge/assets/5251713/570879ef-ef8a-4e00-b37c-b49bc3c1a370">

ChainForge is a data flow prompt engineering environment for analyzing and evaluating LLM responses. It enables rapid-fire, quick-and-dirty comparison of prompts, models, and response quality that goes beyond ad-hoc chatting with individual LLMs. With ChainForge, you can:

- **Query multiple LLMs at once** to test prompt ideas and variations quickly and effectively.
- **Compare response quality across prompt permutations, across models, and across model settings** to choose the best prompt and model for your use case.
- **Setup evaluation metrics** (scoring function) and immediately visualize results across prompts, prompt parameters, models, and model settings.
- **Use AI to streamline this entire process**: Create synthetic tables and input examples with built-in genAI features, or supercharge writing evals by prompting a model to give you starter code.  

[Read the docs to learn more.](https://chainforge.ai/docs/) ChainForge comes with a number of example evaluation flows to give you a sense of what's possible, including 188 example flows generated from benchmarks in OpenAI evals.

ChainForge is built on [ReactFlow](https://reactflow.dev) and [Flask](https://flask.palletsprojects.com/en/2.3.x/).

**_For user-curated resources and learning materials, check out the [🌟Awesome ChainForge](https://github.com/loloMD/awesome_chainforge) repo!_** 


# Table of Contents

- 👉 [Documentation](https://chainforge.ai/docs/) 📖
- [Installation](#installation)
- [Example Experiments](#example-experiments)
- [Share with Others](#share-with-others)
- [Features](#features) (see the [docs](https://chainforge.ai/docs/nodes/) for more comprehensive info)
- [Development and How to Cite](#development)

# Installation

You can install ChainForge locally, or try it out on the web at **https://chainforge.ai/play/**. The web version of ChainForge has a limited feature set. In a locally installed version you can load API keys automatically from environment variables, write Python code to evaluate LLM responses, or query locally-run models hosted via Ollama.

To install Chainforge on your machine, make sure you have Python 3.8 or higher, then run

```bash
pip install chainforge
```

Once installed, do

```bash
chainforge serve
```

Open [localhost:8000](http://localhost:8000/) in a Google Chrome, Firefox, Microsoft Edge, or Brave browser.

You can set your API keys by clicking the Settings icon in the top-right corner. If you prefer to not worry about this everytime you open ChainForge, we **highly recommend** that save your OpenAI, Anthropic, Google, etc API keys and/or Amazon AWS credentials to your local environment. For more details, see the [How to Install](https://chainforge.ai/docs/getting_started/).

## Run using Docker

You can use our [Dockerfile](/Dockerfile) to run `ChainForge` locally using `Docker Desktop`:

- Build the `Dockerfile`:
  ```shell
  docker build -t chainforge .
  ```

- Run the image:
  ```shell
  docker run -p 8000:8000 chainforge
  ```

Now you can open the browser of your choice and open `http://127.0.0.1:8000`.

# Supported providers

- OpenAI
- Anthropic
- Google (Gemini, PaLM2)
- DeepSeek
- HuggingFace (Inference and Endpoints)
- Together.ai
- [Ollama API](https://github.com/jmorganca/ollama) (locally-hosted models)
- Microsoft Azure OpenAI Endpoints
- [Aleph Alpha](https://docs.aleph-alpha.com/docs/introduction)
- Amazon Bedrock-hosted on-demand inference, including Anthropic Claude 3
- ...and any other provider through [custom provider scripts](https://chainforge.ai/docs/custom_providers/)!

# Example experiments

We've prepared many example flows to give you a sense of what's possible with Chainforge.
Click the "Example Flows" button on the top-right corner and select one. Here is a basic comparison example, plotting the length of responses across different models and arguments for the prompt parameter `{game}`:

<img width="1593" alt="basic-compare" src="https://github.com/ianarawjo/ChainForge/assets/5251713/43c87ab7-aabd-41ba-8d9b-e7e9ebe25c75">

You can also conduct **ground truth evaluations** using Tabular Data nodes. For instance, we can compare each LLM's ability to answer math problems by comparing each response to the expected answer:

<img width="1775" alt="Screen Shot 2023-07-04 at 9 21 50 AM" src="https://github.com/ianarawjo/ChainForge/assets/5251713/6d842f7a-f747-44f9-b317-95bec73653c5">

Just import a dataset, hook it up to a template variable in a Prompt Node, and press run. 

# Compare responses across models and prompts

Compare across models and prompt variables with an interactive response inspector, including a formatted table and exportable data:

<img width="1460" alt="Screen Shot 2023-07-19 at 5 03 55 PM" src="https://github.com/ianarawjo/ChainForge/assets/5251713/6aca2bd7-7820-4256-9e8b-3a87795f3e50">

The key power of ChainForge lies in **combinatorial power**: ChainForge takes the _cross product_ of inputs to prompt templates, meaning you can produce every combination of input values.
This is incredibly effective at sending off hundreds of queries at once to verify model behavior more robustly than one-off prompting. 

Here's [a tutorial to get started comparing across prompt templates](https://chainforge.ai/docs/compare_prompts/).

# Share with others

The web version of ChainForge (https://chainforge.ai/play/) includes a Share button.

Simply click Share to generate a unique link for your flow and copy it to your clipboard:

![ezgif-2-a4d8048bba](https://github.com/ianarawjo/ChainForge/assets/5251713/1c69900b-5a0f-4055-bbd3-ea191e93ecde)

For instance, here's a experiment I made that tries to get an LLM to reveal a secret key: https://chainforge.ai/play/?f=28puvwc788bog

> **Note**
> To prevent abuse, you can only share up to 10 flows at a time, and each flow must be <5MB after compression.
> If you share more than 10 flows, the oldest link will break, so make sure to always Export important flows to `cforge` files,
> and use Share to only pass data ephemerally.

For finer details about the features of specific nodes, check out the [List of Nodes](https://chainforge.ai/docs/nodes/).

# Features

A key goal of ChainForge is facilitating **comparison** and **evaluation** of prompts and models. Overall, you can:

- **Compare across prompts and prompt parameters**: Find the best set of prompts that maximizes your eval target metrics (e.g., lowest code error rate). Or, see how changing parameters in a prompt template affects the quality of responses.
- **Compare across models**: Compare responses for every prompt across models and different model settings, to find the best model for your use case. 

The features that enable this area:

- **Prompt permutations**: Setup a prompt template and feed it variations of input variables. ChainForge will prompt all selected LLMs with all possible permutations of the input prompt, so that you can get a better sense of prompt quality. You can also chain prompt templates at arbitrary depth (e.g., to compare templates).
- **Model settings**: Change the settings of supported models, and compare across settings. For instance, you can measure the impact of a system message on ChatGPT by adding several ChatGPT models, changing individual settings, and nicknaming each one. ChainForge will send out queries to each version of the model.
- **Evaluation nodes**: Probe LLM responses in a chain and test them (classically) for some desired behavior. At a basic level, this is Python script based. We plan to add preset evaluator nodes for common use cases in the near future (e.g., name-entity recognition). Note that you can also chain LLM responses into prompt templates to help evaluate outputs cheaply before more extensive evaluation methods.
- **Visualization nodes**: Visualize evaluation results on plots like grouped box-and-whisker (for numeric metrics) and histograms (for boolean metrics). Currently we only support numeric and boolean metrics. We aim to provide users more control and options for plotting in the future.
- **Chat turns**: Go beyond prompts and template follow-up chat messages, just like prompts. You can test how the wording of the user's query might change an LLM's output, or compare quality of later responses across multiple chat models (or the same chat model with different settings!).

Alongside built-in [gen AI features 🪄💫](https://chainforge.ai/docs/gen_ai/) like synthetic data generation, prompt engineering is accelerated: you can compare prompts and model performance sometimes **_without needing to write a single line of code_**, speeding up the process of iteration and discovery tenfold. 

We've also found that some users simply want to use ChainForge to make tons of parametrized queries to LLMs (e.g., chaining prompt templates into prompt templates), possibly score them, and then output the results to a spreadsheet (Excel `xlsx`). To do this, attach an Inspect node to the output of a Prompt node and click `Export Data`.

For more specific details, see our [documentation](https://chainforge.ai/docs/nodes/).

---

# Development

ChainForge was created by [Ian Arawjo](http://ianarawjo.com/index.html), a postdoctoral scholar in Harvard HCI's [Glassman Lab](http://glassmanlab.seas.harvard.edu/) with support from the Harvard HCI community. Collaborators include PhD students [Priyan Vaithilingam](https://priyan.info) and [Chelse Swoopes](https://seas.harvard.edu/person/chelse-swoopes), Harvard undergraduate [Sean Yang](https://shawsean.com), and faculty members [Elena Glassman](http://glassmanlab.seas.harvard.edu/glassman.html) and [Martin Wattenberg](https://www.bewitched.com/about.html). Additional collaborators include UC Berkeley PhD student Shreya Shankar and Université de Montréal undergraduate Cassandre Hamel.

This work was partially funded by the NSF grants IIS-2107391, IIS-2040880, and IIS-1955699. Any opinions, findings, and conclusions or recommendations expressed in this material are those of the author(s) and do not necessarily reflect the views of the National Science Foundation.

We provide ongoing releases of this tool in the hopes that others find it useful for their projects.

## Inspiration and Links

ChainForge is meant to be general-purpose, and is not developed for a specific API or LLM back-end. Our ultimate goal is integration into other tools for the systematic evaluation and auditing of LLMs. We hope to help others who are developing prompt-analysis flows in LLMs, or otherwise auditing LLM outputs. This project was inspired by own our use case, but also shares some comraderie with two related (closed-source) research projects, both led by [Sherry Wu](https://www.cs.cmu.edu/~sherryw/):

- "PromptChainer: Chaining Large Language Model Prompts through Visual Programming" (Wu et al., CHI ’22 LBW) [Video](https://www.youtube.com/watch?v=p6MA8q19uo0)
- "AI Chains: Transparent and Controllable Human-AI Interaction by Chaining Large Language Model Prompts" (Wu et al., CHI ’22)

Unlike these projects, we are focusing on supporting evaluation across prompts, prompt parameters, and models.

## How to collaborate?

We welcome open-source collaborators. If you want to report a bug or request a feature, open an [Issue](https://github.com/ianarawjo/ChainForge/issues). We also encourage users to implement the requested feature / bug fix and submit a Pull Request.

---

# Cite Us

If you use ChainForge for research purposes, whether by building upon the source code or investigating LLM behavior using the tool, we ask that you cite our [CHI research paper](https://dl.acm.org/doi/full/10.1145/3613904.3642016) in any related publications. The BibTeX you can use is:

```bibtex
@inproceedings{arawjo2024chainforge,
  title={ChainForge: A Visual Toolkit for Prompt Engineering and LLM Hypothesis Testing},
  author={Arawjo, Ian and Swoopes, Chelse and Vaithilingam, Priyan and Wattenberg, Martin and Glassman, Elena L},
  booktitle={Proceedings of the CHI Conference on Human Factors in Computing Systems},
  pages={1--18},
  year={2024}
}
```

# License

ChainForge is released under the MIT License.
