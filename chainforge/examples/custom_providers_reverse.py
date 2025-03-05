from chainforge.providers import provider

@provider(name="Mirror", emoji="🪞")
def mirror_the_prompt(prompt: str, **kwargs) -> str:
    return prompt[::-1]
