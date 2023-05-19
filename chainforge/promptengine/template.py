from string import Template
from typing import Dict, List, Union

class PromptTemplate:
    """
    Wrapper around string.Template. Use to generate prompts fast.

    Example usage:
        prompt_temp = PromptTemplate('Can you list all the cities in the country ${country} by the cheapest ${domain} prices?')
        concrete_prompt = prompt_temp.fill({
            "country": "France",
            "domain": "rent"
        });
        print(concrete_prompt)

        # Fill can also fill the prompt only partially, which gives us a new prompt template: 
        partial_prompt = prompt_temp.fill({
            "domain": "rent"
        });
        print(partial_prompt)
    """
    def __init__(self, templateStr):
        """
            Initialize a PromptTemplate with a string in string.Template format.
            (See https://docs.python.org/3/library/string.html#template-strings for more details.)
        """
        try:
            Template(templateStr)
        except:
            raise Exception("Invalid template formatting for string:", templateStr)
        self.template = templateStr
        self.fill_history = {}

    def __str__(self) -> str:
        return self.template
    
    def __repr__(self) -> str:
        return self.__str__()
    
    def has_var(self, varname) -> bool:
        """ Returns True if the template has a variable with the given name.
        """
        subbed_str = Template(self.template).safe_substitute({varname: '_'})
        return subbed_str != self.template  # if the strings differ, a replacement occurred 

    def is_concrete(self) -> bool:
        """ Returns True if no template variables are left in template string.
        """
        try:
            Template(self.template).substitute({})
            return True # no exception raised means there was nothing to substitute...
        except KeyError as e:
            return False
        
    def fill(self, paramDict: Dict[str, Union[str, Dict[str, str]]]) -> 'PromptTemplate':
        """
            Formats the template string with the given parameters, returning a new PromptTemplate.
            Can return a partial completion. 

            NOTE: paramDict values can be in a special form: {text: <str>, fill_history: {varname: <str>}}
                  in order to bundle in any past fill history that is lost in the current text.

            Example usage:
                prompt = prompt_template.fill({
                    "className": className,
                    "library": "Kivy",
                    "PL": "Python"
                });
        """
        # Check for special 'past fill history' format:
        past_fill_history = {}
        if len(paramDict) > 0 and isinstance(next(iter(paramDict.values())), dict):
            for obj in paramDict.values():
                past_fill_history = {**obj['fill_history'], **past_fill_history}
            paramDict = {param: obj['text'] for param, obj in paramDict.items()}

        filled_pt = PromptTemplate(
            Template(self.template).safe_substitute(paramDict)
        )

        # Deep copy prior fill history of this PromptTemplate from this version over to new one
        filled_pt.fill_history = { key: val for (key, val) in self.fill_history.items() }

        # Append any past history passed as vars:
        for key, val in past_fill_history.items():
            if key in filled_pt.fill_history:
                print(f"Warning: PromptTemplate already has fill history for key {key}.")
            filled_pt.fill_history[key] = val

        # Add the new fill history using the passed parameters that we just filled in
        for key, val in paramDict.items():
            if key in filled_pt.fill_history:
                print(f"Warning: PromptTemplate already has fill history for key {key}.")
            filled_pt.fill_history[key] = val
        
        return filled_pt


class PromptPermutationGenerator:
    """
    Given a PromptTemplate and a parameter dict that includes arrays of items, 
    generate all the permutations of the prompt for all permutations of the items.

    NOTE: Items can be in a special form: {text: <str>, fill_history: {varname: <str>}}
          in order to bundle in any past fill history that is lost in the current text.

    Example usage:
        prompt_gen = PromptPermutationGenerator('Can you list all the cities in the country ${country} by the cheapest ${domain} prices?')
        for prompt in prompt_gen({"country":["Canada", "South Africa", "China"], 
                                  "domain": ["rent", "food", "energy"]}):
            print(prompt)
    """
    def __init__(self, template: Union[PromptTemplate, str]):
        if isinstance(template, str):
            template = PromptTemplate(template)
        self.template = template
    
    def _gen_perm(self, template, params_to_fill, paramDict):
        if len(params_to_fill) == 0: return []

        # Extract the first param that occurs in the current template
        param = None
        params_left = params_to_fill
        for p in params_to_fill:
            if template.has_var(p):
                param = p
                params_left = [_p for _p in params_to_fill if _p != p]
                break
        
        if param is None:
            return [template]

        # Generate new prompts by filling in its value(s) into the PromptTemplate
        val = paramDict[param]
        if isinstance(val, list):
            new_prompt_temps = [template.fill({param: v}) for v in val]
        elif isinstance(val, str):
            new_prompt_temps = [template.fill({param: val})]
        else:
            raise ValueError("Value of prompt template parameter is not a list or a string, but of type " + str(type(val)))
        
        # Recurse
        if len(params_left) == 0:
            return new_prompt_temps
        else:
            res = []
            for p in new_prompt_temps:
                res.extend(self._gen_perm(p, params_left, paramDict))
            return res

    def __call__(self, paramDict: Dict[str, Union[str, List[str], Dict[str, str]]]):
        if len(paramDict) == 0:
            yield self.template
            return

        for p in self._gen_perm(self.template, list(paramDict.keys()), paramDict):
            yield p

# Test cases
if __name__ == '__main__':
    # Single template
    gen = PromptPermutationGenerator('What is the ${timeframe} when ${person} was born?')
    res = [r for r in gen({'timeframe': ['year', 'decade', 'century'], 'person': ['Howard Hughes', 'Toni Morrison', 'Otis Redding']})]
    for r in res:
        print(r)
    assert len(res) == 9

    # Nested templates
    gen = PromptPermutationGenerator('${prefix}... ${suffix}')
    res = [r for r in gen({
        'prefix': ['Who invented ${tool}?', 'When was ${tool} invented?', 'What can you do with ${tool}?'],
        'suffix': ['Phrase your answer in the form of a ${response_type}', 'Respond with a ${response_type}'],
        'tool': ['the flashlight', 'CRISPR', 'rubber'],
        'response_type': ['question', 'poem', 'nightmare']
    })]
    for r in res:
        print(r)
    assert len(res) == (3*3)*(2*3)