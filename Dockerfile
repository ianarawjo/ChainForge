FROM python:3.12-slim

RUN apt-get --allow-releaseinfo-change update && apt-get install -y \
    build-essential && rm -rf /var/lib/apt/lists/*

WORKDIR /chainforge

RUN pip install --upgrade pip
COPY chainforge/requirements.txt .
RUN pip install -r requirements.txt
COPY . .
RUN python setup.py sdist
RUN pip install -e .
EXPOSE 8000
ENTRYPOINT [ "chainforge", "serve", "--host", "0.0.0.0" ]
