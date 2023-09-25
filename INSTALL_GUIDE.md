# Installation Guide

There are two ways to use ChainForge:
 - Via the web version, hosted at https://chainforge.ai/play/. This requires no installation, but is slightly more limited than the full version.
 - By installing on your local machine. This has the benefit of being able to load API keys from environment variables, run Python evaluator nodes, and query Dalai-hosted models. 

This document concerns the latter (local installation). 

## Step 1. Install on your machine
The simplest and safest way to install the latest public build of ChainForge is to:
 1. Create a new directory and `cd` into it
 2. _(Optional, but recommended!)_ Create a virtual environment. On Mac, you can do 
    ```bash
    python -m venv venv
    source venv/bin/activate
    ```
 3. Install `chainforge` via `pip`:
    ```bash
    pip install chainforge
    ```
 4. Run:
    ```bash
    chainforge serve
    ```
    > **Note**
    > If you'd like to run ChainForge on a different hostname and port, specify `--host` and `--port`. For instance, ```chainforge serve --host 0.0.0.0 --port 3400```
 5. Open [localhost:8000](http://localhost:8000/) on a recent version of Google Chrome, Mozilla Firefox, Microsoft Edge (Chromium), or Brave browser.

> **Note**
> ChainForge beta version currently does not support other browsers, but if you want support, please open an Issue or make a Pull Request. The main barrier at the moment is that CSS formatting is slightly different for Safari and other browsers; to fix this, we'd need to correct said formatting problems.

## Step 2. Get and set API keys for certain model providers

Though you can run Chainforge, you can't do anything with it without the ability to call an LLM. Currently we support model providers:
 - OpenAI models GPT3.5 and GPT4, including all variants and function calls
 - HuggingFace models (via the HuggingFace Inference and Inference Endpoints API)
 - Anthropic models
 - Google PaLM2 chat and text bison models
 - Aleph Alpha Luminous Models
 - Azure OpenAI Endpoints
 - (Locally run) Alpaca and Llama models [Dalai](https://github.com/cocktailpeanut/dalai)-served Alpaca.7b at port 4000.
    - To query models like Alpaca and Llama run on your local machine via Dalai, [install `dalai`](https://github.com/cocktailpeanut/dalai) and follow the instructions to download `alpaca.7b`. When everything is setup, run `npx dalai serve 4000`.

### How to Set API keys for specific model providers (non-Dalai models)
To use a specific model provider, you need to do two things:
 1. **Get an API key.** HuggingFace API keys [are free](https://huggingface.co/docs/api-inference/quicktour). OpenAI API keys are easy to access, and you can even [get one for free during a trial period](https://openaimaster.com/how-to-get-openai-api-key-for-free/). For other providers, see their pages and sign up for access. 
 3. **Set the relevant API key in ChainForge.** You can input your API keys manually via the Settings button in the top-right corner. However, this can become tedious fast. If you'd prefer to not be bothered every time you load ChainForge, you can set them as environment keys. To do so, follow [this guide](https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety), section 3, "Use Environment Variables in place of your API key." When following the instructions, **swap OPENAI_API_KEY for the alias of your specific model provider, listed below:**
     - OpenAI: `OPENAI_API_KEY`
     - HuggingFace: `HUGGINGFACE_API_KEY`
     - Anthropic: `ANTHROPIC_API_KEY`
     - Google PaLM2: `PALM_API_KEY`
     - Aleph Alpha: `ALEPH_ALPHA_API_KEY`
     - Azure OpenAI: Set two keys, `AZURE_OPENAI_KEY` and `AZURE_OPENAI_ENDPOINT`. Note that the endpoint should look like a base URL. For examples on what these keys look like, see the [Azure OpenAI documentation](https://learn.microsoft.com/en-us/azure/cognitive-services/openai/chatgpt-quickstart?tabs=command-line&pivots=programming-language-javascript).
 - When you are done setting the API key(s), **reopen your terminal**. _(This is because the terminal loads the environment variables when it is first opened, so it needs to be refreshed before running `chainforge serve`.)_

For instance, to set an OpenAI API key as an environment variable on Macs, do this from the terminal:
   ```bash
   echo "export OPENAI_API_KEY='yourkey'" >> ~/.zshrc
   source ~/.zshrc
   echo $OPENAI_API_KEY
   ```
Then, make sure to **reopen your terminal**.

## Step 3. Check out Examples! 

Click Example Flows to get a sense of what ChainForge is capable of. A popular choice is ground truth evaluations, which use Tabular Data nodes. 

---------------------------------
# For developers

Below is a guide for running the beta version of ChainForge directly from source, for people who want to modify, develop or extend it. 
Note that these steps may change in the future.

### Install requirements
Before you can run ChainForge, you need to install dependencies. `cd` into `chainforge` and run

```bash
pip install -r requirements.txt
```

to install requirements. (Ideally, you will run this in a `virtualenv`.)

To install Node.js requirements, first make sure you have Node.js installed. Then `cd` into `chainforge/react-server` and run:

```bash
npm install
```

> You might run into dependency conflicts. You can re-run with `--force` to force continued installation.

### Serving ChainForge manually

To serve ChainForge manually, you have two options:
 1. Run everything from a single Python script, which requires building the React app to static files, or 
 2. Serve the React front-end separately from the Flask back-end and take advantage of React hot reloading. 

We recommend the former option for end-users, and the latter for developers.

#### Option 1: Build React app as static files (end-users)

`cd` into `react-server` directory and run:

```
npm run build
```

Wait a moment while it builds the React app to static files.

#### Option 2: Serve React front-end with hot reloading (developers)

`cd` into `react-server` directory and run the following to serve the React front-end:

```
npm run start
```

### Serving the backend

Regardless of which option you chose, `cd` into the root ChainForge directory and run:

```bash
python -m chainforge.app serve
```

This script spins up a Flask server on port 8000. Note that most of the app logic is fully in the browser, but some calls (like loading API keys as environment variables, or querying Dalai-hosted models or Anthropic API) still go through the Flask server.

If you built the React app statically, go to `localhost:8000` in a web browser to view the app (ideally in Google Chrome). 
If you served the React app with hot reloading with `npm run start`, go to the server address you ran it on (usually `localhost:3000`).

## Problems?

Open an [Issue](https://github.com/ianarawjo/ChainForge/issues).

# Contributing to ChainForge

If you want to contribute, welcome! Please [fork this repository](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request-from-a-fork) and submit a [Pull Request](https://github.com/ianarawjo/ChainForge/pulls) with your changes.

If you have access to the main repository, we request that you add a branch `dev/<your_first_name>` and develop changes from there. When you are ready to push changes, say to address an open Issue, make a Pull Request on the `experimental` repository and assign the main developer (Ian Arawjo) to it.
