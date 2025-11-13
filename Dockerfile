FROM python:3.12-alpine

RUN apk add --no-cache build-base git

WORKDIR /chainforge

RUN pip install --no-cache-dir --upgrade pip
COPY chainforge/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN python setup.py sdist
RUN pip install -e .
EXPOSE 8000
ENTRYPOINT [ "chainforge", "serve", "--host", "0.0.0.0" ]
