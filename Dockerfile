FROM python:3.12-slim AS builder

RUN pip install --upgrade pip
RUN pip install chainforge --no-cache-dir

WORKDIR /chainforge

EXPOSE 8000
ENTRYPOINT [ "chainforge", "serve", "--host", "0.0.0.0" ]
