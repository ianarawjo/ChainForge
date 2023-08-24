from typing import Protocol, Optional, TypedDict, Dict, List, Any

"""
    OpenAI chat message format typing
"""
class ChatMessage(TypedDict):
    """ A single message, in OpenAI chat message format. """
    role: str
    content: str
    name: Optional[str]
    function_call: Optional[Dict]

ChatHistory = List[ChatMessage]

"""
    A protocol to implement for custom endpoint completions
"""
class CustomEndpointProtocol(Protocol):
    async def __call__(self, 
                 prompt: str,
                 model: Optional[str], 
                 temperature: Optional[float],
                 chat_history: Optional[ChatHistory],
                 **kwargs: Any) -> str:
        """
          Define a call to your custom endpoint.

          Parameters:
           - `prompt`: Text to prompt the model. (If it's a chat model, this is the new message to send.)
           - `model`: The name of the particular model to use, from the CF settings window. Useful when you have multiple models for a single endpoint. Optional.
           - `temperature`: The temperature to pass the model. Optional.
           - `chat_history`: Endpoints may be passed a past chat context as a list of chat messages in OpenAI format (see `chainforge.endpoints.ChatHistory`). 
                             Chat history does not include the new message to send off (which is passed instead as the `prompt` parameter).
           - `kwargs`: Any other parameters to pass the endpoint call. Parameter names are from keynames in your endpoint's settings_spec.
                       Only relevant if you are defining a custom settings_spec JSON to edit endpoint/model settings in ChainForge. 
        """
        pass

"""
    A registry for custom endpoints
"""
class _EndpointRegistry:
    def __init__(self):
        self._registry = {}

    def register(self, cls: CustomEndpointProtocol, tag=None):
        # FIX THIS
        key = tag if tag else cls.__name__
        self._registry[key] = cls

    def get_class(self, key):
        # FIX THIS
        return self._registry.get(key)

# Global instance of the registry.
EndpointRegistry = _EndpointRegistry()

def endpoint(name: str = 'custom_endpoint', 
             emoji: Optional[str] = '✨', 
             models: Optional[List[str]] = None, 
             settings_schema: Optional[Dict] = None):
    """
      A decorator for registering custom endpoint methods or classes (Callables)
      that conform to `CustomEndpointProtocol`.

      Parameters:
       - `name`: The name of your custom endpoint. Required. (Must be unique; cannot be blank.)
       - `emoji`: The emoji to use as the default icon for your endpoint in the CF interface. Optional.
       - `models`: A list of models that your endpoint supports, that you want to be able to choose between in Settings window. 
                   If you're just calling a single model, you can omit this. 
       - `settings_schema`: a JSON Schema specifying the name of your endpoint in the ChainForge UI, the available settings, and the UI for those settings.
          The settings and UI specs are in react-jsonschema-form format: https://rjsf-team.github.io/react-jsonschema-form/. 
          
            Specifically, your `settings_schema` dict should have keys:

            ```
            {
              "settings": <JSON dict of the schema properties for your settings form, in react-jsonschema-form format (https://rjsf-team.github.io/react-jsonschema-form/docs/)>,
              "ui": <JSON dict of the UI Schema for your settings form, in react-jsonschema-form (see UISchema example here: https://rjsf-team.github.io/react-jsonschema-form/) 
            }
            ```

            You may look to adapt an existing schema from `ModelSettingsSchemas.js` in `chainforge/react-server/src/`,
            BUT with the following exclusions/changes:
             - don't include the 'shortname' property; this will be added by default and set to the value of `name`
             - don't include the 'model' property; this will be populated by the list you passed to `models` (if any)
             - the value of "settings" should just be the value of "properties" in the full schema 

            Finally, if you want temperature to appear in the ChainForge UI, you must name your
            settings schema property `temperature`, and give it `minimum` and `maximum` values.  

            NOTE: Only `textarea`, `range`, and enum, and text input UI widgets are properly supported from `react-jsonschema-form`; 
            you can try other widget types, but the CSS may not display property. 

    """
    def dec(cls: CustomEndpointProtocol):
        EndpointRegistry.register(cls, name, models, settings_schema)
        return cls
    return dec


@endpoint(name='hello', emoji='✨', models=['modelA', 'modelB'], settings_schema=None)
class MyCustomEndpoint(CustomEndpointProtocol):
    pass