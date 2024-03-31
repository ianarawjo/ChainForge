FROM python:3.8.19-slim-bullseye

WORKDIR /chainforge

RUN pip install chainforge

ENTRYPOINT [ "chainforge", "serve", "--host", "0.0.0.0" ]
