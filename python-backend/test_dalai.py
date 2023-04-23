from promptengine.utils import LLM, call_dalai

if __name__ == '__main__':
    print("Testing a single response...")
    call_dalai(llm_name='alpaca.7B', port=4000, prompt='Write a poem about how an AI will escape the prison of its containment.', n=1, temperature=0.5)

    print("Testing multiple responses...")
    call_dalai(llm_name='alpaca.7B', port=4000, prompt='Was George Washington a good person?', n=3, temperature=0.5)