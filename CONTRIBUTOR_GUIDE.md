# Contributor Guide

This is a guide to running the current version of ChainForge, for people who want to develop or extend it. 
Note that this document will change in the future.

## Getting Started
### Install requirements
Before you can run ChainForge, you need to install dependencies. `cd` into `python-backend` and run

```bash
pip install -r requirements.txt
```

to install requirements. (Ideally, you will run this in a `virtualenv`.)

To install Node.hs requirements, first make sure you have Node.js installed. Then `cd` into `chain-forge` and run:

```bash
npm install
```

## Running ChainForge

To serve ChainForge, you have two options:
 1. Run everything from a single Python script, which requires building the React app to static files, or 
 2. Serve the React front-end separately from the Flask back-end and take advantage of React hot reloading. 

We recommend the former option for end-users, and the latter for developers.

### Option 1: Build React app as static files (end-users)

`cd` into `chain-forge` directory and run:

```
npm run build
```

Wait a moment while it builds the React app to static files. 

### Option 2: Serve React front-end with hot reloading (developers)

`cd` into `chain-forge` directory and run the following to serve the React front-end:

```
npm run start
```

### Serving the backend

Regardless of which option you chose, `cd` into `python-backend` and run:

```bash
python app.py 
```

> **Note**
> You can add the `--dummy-responses` flag in case you're worried about making calls to OpenAI. This will spoof all LLM responses as random strings, and is great for testing the interface without accidentally spending $$.

This script spins up two servers, the main one on port 8000 and a SocketIO server on port 8001 (used for streaming progress updates).

If you built the React app statically, go to `localhost:8000` in a web browser to view the app. 
If you served the React app with hot reloading with `npm run start`, go to the server address you ran it on (usually `localhost:3000`).

## Activate OpenAI / Anthropic keys or install Dalai

Though you can run Chainforge, you can't do anything with it without an LLM.
Currently we support OpenAI models GPT3.5 and GPT4, Anthropic model Claudev1, and (locally run) Dalai-served Alpaca.7b.

To use OpenAI models, you need to set an environment variable with your OpenAI key:
https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety

For Mac, for instance, follow:

```bash
echo "export OPENAI_API_KEY='yourkey'" >> ~/.zshrc
source ~/.zshrc
echo $OPENAI_API_KEY
```

For Anthropic's API key on Mac, do the same as above but with `ANTHROPIC_API_KEY` replaced for `OpenAI_API_KEY`. 

## Contributing to ChainForge

If you have access to the main repository, we request that you add a branch `dev/<your_first_name>` and develop changes from there. When you are ready to push changes, say to addres an open Issue, make a Pull Request on the `main` repository and assign the main developer (Ian Arawjo) to it.
