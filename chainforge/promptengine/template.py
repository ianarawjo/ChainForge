import re
from string import Template
from typing import Dict, List, Union

def escape_dollar_signs(s: str) -> str:
    pattern = r'\$(?![{])'
    replaced_string = re.sub(pattern, '$$', s)
    return replaced_string

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
        # NOTE: ChainForge only supports placeholders with braces {}
        # We detect any $ without { to the right of them, and insert a '$' before it to escape the $.  
        templateStr = escape_dollar_signs(templateStr)
        try:
            Template(templateStr)
        except Exception:
            raise Exception("Invalid template formatting for string:", templateStr)
        self.template = templateStr
        self.fill_history = {}
        self.metavars = {}

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
        except Exception:
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
        past_metavars = {}
        if len(paramDict) > 0 and isinstance(next(iter(paramDict.values())), dict):
            for obj in paramDict.values():
                if "fill_history" in obj:
                    past_fill_history = {**obj['fill_history'], **past_fill_history}
                if "metavars" in obj:
                    past_metavars = {**obj['metavars'], **past_metavars}
            paramDict = {param: obj['text'] for param, obj in paramDict.items()}

        filled_pt = PromptTemplate(
            Template(self.template).safe_substitute(paramDict)
        )

        # Deep copy prior fill history of this PromptTemplate from this version over to new one
        filled_pt.fill_history = { key: val for (key, val) in self.fill_history.items() }
        filled_pt.metavars = { key: val for (key, val) in self.metavars.items() }

        # Append any past history passed as vars:
        for key, val in past_fill_history.items():
            if key in filled_pt.fill_history:
                print(f"Warning: PromptTemplate already has fill history for key {key}.")
            filled_pt.fill_history[key] = val
        
        # Append any metavars, overwriting existing ones with the same key
        for key, val in past_metavars.items():
            filled_pt.metavars[key] = val

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
            new_prompt_temps = []
            for v in val:
                param_fill_dict = {param: v}

                # If this var has an "associate_id", then it wants to "carry with"
                # values of other prompt parameters with the same id. 
                # We have to find any parameters with values of the same id, 
                # and fill them in alongside the initial parameter v:
                if isinstance(v, dict) and "associate_id" in v:
                    v_associate_id = v["associate_id"]
                    for other_param in params_left[:]:
                        if template.has_var(other_param) and isinstance(paramDict[other_param], list):
                            other_vals = paramDict[other_param]
                            for ov in other_vals:
                                if isinstance(ov, dict) and ov.get("associate_id") == v_associate_id:
                                    # This is a match. We should add the val to our param_fill_dict:
                                    param_fill_dict[other_param] = ov
                                    break
                
                # Fill the template with the param values and append it to the list
                new_prompt_temps.append(template.fill(param_fill_dict))
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
    # Dollar sign escape works 
    tests = ["What is $2 + $2?", "If I have $4 and I want ${dollars} then how many do I have?", "$4 is equal to ${dollars}?", "${what} is the $400?"]
    escaped_tests = [escape_dollar_signs(t) for t in tests]
    print(escaped_tests)
    assert escaped_tests[0] == "What is $$2 + $$2?"
    assert escaped_tests[1] == "If I have $$4 and I want ${dollars} then how many do I have?"
    assert escaped_tests[2] == "$$4 is equal to ${dollars}?"
    assert escaped_tests[3] == "${what} is the $$400?"

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

    # 'Carry together' vars with 'metavar' data attached
    # NOTE: This feature may be used when passing rows of a table, so that vars that have associated values,
    #       like 'inventor' with 'tool', 'carry together' when being filled into the prompt template. 
    #       In addition, 'metavars' may be attached which are, commonly, the values of other columns for that row, but
    #       columns which weren't used to fill in the prompt template explcitly.
    gen = PromptPermutationGenerator('What ${timeframe} did ${inventor} invent the ${tool}?')
    res = [r for r in gen({
        'inventor': [
            {'text': "Thomas Edison", "fill_history": {}, "associate_id": "A", "metavars": { "year": 1879 }},
            {'text': "Alexander Fleming", "fill_history": {}, "associate_id": "B", "metavars": { "year": 1928 }},
            {'text': "William Shockley", "fill_history": {}, "associate_id": "C",  "metavars": { "year": 1947 }},
        ],
        'tool': [
            {'text': "lightbulb", "fill_history": {}, "associate_id": "A"},
            {'text': "penicillin", "fill_history": {}, "associate_id": "B"},
            {'text': "transistor", "fill_history": {}, "associate_id": "C"},
        ],
        'timeframe': [ "year", "decade", "century" ]
    })]
    for r in res:
        r_str = str(r)
        print(r_str, r.metavars)
        assert "year" in r.metavars
        if "Edison" in r_str:
            assert "lightbulb" in r_str
        elif "Fleming" in r_str:
            assert "penicillin" in r_str
        elif "Shockley" in r_str:
            assert "transistor" in r_str
    assert len(res) == 3*3