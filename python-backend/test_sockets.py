import json, os, asyncio, sys, argparse
from dataclasses import dataclass
from statistics import mean, median, stdev
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO
from promptengine.query import PromptLLM, PromptLLMDummy
from promptengine.template import PromptTemplate, PromptPermutationGenerator
from promptengine.utils import LLM, extract_responses, is_valid_filepath, get_files_at_dir, create_dir_if_not_exists

app = Flask(__name__)

# Set up CORS for specific routes
# cors = CORS(app, resources={r"/api/*": {"origins": "*"}})

# Initialize Socket.IO
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="gevent")

# Wait a max of a full minute (60 seconds) for the response count to update, before exiting.
MAX_WAIT_TIME = 60

# import threading
# thread = None
# thread_lock = threading.Lock()

def countdown():
    n = 10
    while n > 0:
        socketio.sleep(0.5)
        socketio.emit('response', n, namespace='/queryllm')
        n -= 1

def readCounts(id, max_count):
    i = 0
    n = 0
    last_n = 0
    while i < MAX_WAIT_TIME and n < max_count:
        with open(f'cache/_temp_{id}.txt', 'r') as f:
            queries = json.load(f)
        n = sum([int(n) for llm, n in queries.items()])
        print(n)
        socketio.emit('response', queries, namespace='/queryllm')
        socketio.sleep(0.1)
        if last_n != n:
            i = 0
            last_n = n
        else:
            i += 0.1

    if i >= MAX_WAIT_TIME:
        print(f"Error: Waited maximum {MAX_WAIT_TIME} seconds for response count to update. Exited prematurely.")
        socketio.emit('finish', 'max_wait_reached', namespace='/queryllm')
    else:
        print("All responses loaded!")
        socketio.emit('finish', 'success', namespace='/queryllm')

@socketio.on('queryllm', namespace='/queryllm')
def testSocket(data):
    readCounts(data['id'], data['max'])
    # countdown()
    # global thread
    # with thread_lock:
    #     if thread is None:
    #         thread = socketio.start_background_task(target=countdown)

if __name__ == "__main__":
    socketio.run(app, host="localhost", port=8001)