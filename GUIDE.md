# Installation Guide

## For casual users 

The simplest and safest way to install the latest public build of ChainForge is to:
 1. Create a new directory and `cd` into it
 2. (Optional, but recommended!) Create a virtual environment. On Mac, you can do 
    ```bash
    python -m venv venv
    source venv/bin/activate
    ```
 3. Install `chainforge` via `pip`:
    ```bash
    pip install chainforge
    ```
 4. Make sure you have OpenAI or Anthropic API keys set as environment variables. For more info, see below.
 4. Run
    ```bash
    chainforge serve
    ```
 5. Open [localhost:8000](http://localhost:8000/) on a recent version of Google Chrome.

> **Note**
> ChainForge alpha is tested on Google Chrome. It currently does not work in earlier versions of Safari. We recommend you open it in Chrome.

## Activate OpenAI / Anthropic keys or install Dalai

Though you can run Chainforge, you can't do anything with it without an LLM.
Currently we support OpenAI models GPT3.5 and GPT4, Anthropic model Claudev1, and (locally run) [Dalai](https://github.com/cocktailpeanut/dalai)-served Alpaca.7b.

### OpenAI
To use OpenAI models, you need to set an environment variable with your OpenAI key:
https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety

For Mac, for instance, follow:

```bash
echo "export OPENAI_API_KEY='yourkey'" >> ~/.zshrc
source ~/.zshrc
echo $OPENAI_API_KEY
```

Then, **reopen your terminal**.

### Anthropic
For Anthropic's API key on Mac, do the same as above but with `ANTHROPIC_API_KEY` replaced for `OpenAI_API_KEY`.

### Alpaca 7B with Dalai
For Dalai, [install `dalai`](https://github.com/cocktailpeanut/dalai) and follow the instructions to download `alpaca.7b`. When everything is setup, run:

```bash
npx dalai serve 4000
```

---------------------------------
## For developers

Below is a guide to running the alpha version of ChainForge directly, for people who want to modify, develop or extend it. 
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

> **Note**
> You can add the `--dummy-responses` flag in case you're worried about making calls to OpenAI. This will spoof all LLM responses as random strings, and is great for testing the interface without accidentally spending $$.

This script spins up two servers, the main one on port 8000 and a SocketIO server on port 8001 (used for streaming progress updates).

If you built the React app statically, go to `localhost:8000` in a web browser to view the app (ideally in Google Chrome). 
If you served the React app with hot reloading with `npm run start`, go to the server address you ran it on (usually `localhost:3000`).

## Problems?

Open an [Issue](https://github.com/ianarawjo/ChainForge/issues).

# Contributing to ChainForge

If you want to contribute, welcome! Please [fork this repository](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request-from-a-fork) and submit a [Pull Request](https://github.com/ianarawjo/ChainForge/pulls) with your changes.

If you have access to the main repository, we request that you add a branch `dev/<your_first_name>` and develop changes from there. When you are ready to push changes, say to address an open Issue, make a Pull Request on the `experimental` repository and assign the main developer (Ian Arawjo) to it.
