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
