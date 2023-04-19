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
    
    def is_concrete(self) -> bool:
        """ Returns True if no template variables are left in template string.
        """
        try:
            Template(self.template).substitute({})
            return True # no exception raised means there was nothing to substitute...
        except KeyError as e:
            return False
        
    def fill(self, paramDict: Dict[str, str]) -> 'PromptTemplate':
        """
            Formats the template string with the given parameters, returning a new PromptTemplate.
            Can return a partial completion. 

            Example usage:
                prompt = prompt_template.fill({
                    "className": className,
                    "library": "Kivy",
                    "PL": "Python"
                });
        """
        filled_pt = PromptTemplate(
            Template(self.template).safe_substitute(paramDict)
        )

        # Deep copy prior fill history from this version over to new one
        filled_pt.fill_history = { key: val for (key, val) in self.fill_history.items() }

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

        # Peel off first element
        param = params_to_fill[0]
        params_left = params_to_fill[1:]

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
                res.extend(self._gen_perm(p, params_to_fill[1:], paramDict))
            return res

    def __call__(self, paramDict: Dict[str, Union[str, List[str]]]):
        for p in self._gen_perm(self.template, list(paramDict.keys()), paramDict):
            yield p