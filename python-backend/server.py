import subprocess

subprocess.run("python socketio_app.py & python app.py & wait", shell=True)