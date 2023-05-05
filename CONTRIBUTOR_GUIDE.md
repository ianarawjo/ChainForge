# Contributor Guide

This is a guide to running the current version of ChainForge, for people who want to develop or extend it. 
Note that this document will change in the future.

## Getting Started
### Install requirements
Before you can run ChainForge, you need to install dependencies. `cd` into `python-backend` and run

```bash
pip install -r requirements.txt
```

to install requirements. Ideally, you will run this in a `virtualenv`.

To install Node requirements, `cd` into `chain-forge` and run:

```bash
npm install
```

### Running ChainForge
To serve ChainForge, you currently have to spin up at least two servers:
one for React front-end, one for the Flask backend.

`cd` into `chain-forge` directory and run:

```
npm run start
```

to serve the React front-end. Then in a separate terminal `cd` into `python-backend` and run:

```bash
python app.py --port 8000 
```
You can add the `--dummy-responses` flag in case you're worried about making calls to OpenAI. 
