import { isEqual } from "./setUtils";

function len(o: object | string | Array<any>): number {
    // Acts akin to Python's builtin 'len' method
    if (Array.isArray(o)) {
        return o.length;
    } else if (typeof o === 'object') {
        return Object.keys(o).length;
    } else if (typeof o === 'string') {
        return o.length;
    } else {
        const typ = typeof o;
        throw new Error(`Unsupported type ${typ} passed to len() method.`)
    }
}

function isDict(o: any): boolean {
    return typeof o === 'object' && !Array.isArray(o);
}

/**
 * Given a string, returns the same string with braces { and } escaped, \{ and \}. Does nothing else.
 * @param str The string to transform
 */
export function escapeBraces(str: string): string {
    return str.replace(/[{}]/g, '\\$&');
}

/**
 * Whether s1 and s2 contain the same set of template variables.
 */
export function containsSameTemplateVariables(s1: string, s2: string): boolean {
  const vars1 = new Set(new StringTemplate(s1).get_vars());
  const vars2 = new Set(new StringTemplate(s2).get_vars());
  return isEqual(vars1, vars2);
}

/**
 * Given a string, returns the same string with the \ before any braces \{ and \} removed. Does nothing else.
 * @param str The string to transform
 */
export function cleanEscapedBraces(str: string): string {
    return str.replaceAll('\\{', '{').replaceAll('\\}', '}');
}


export class StringTemplate {
    val: string;
    /**
     * Javascript's in-built template literals is nowhere as good
     * as Python's Template in the string library. We need to recreate
     * Python's Template class here for the below to work. 
     */
    constructor(str: string) {
        this.val = str;
    }

    /** Safely substitutes the template variables 'key' for the passed values,
     * soft-failing for any keys which were not found. 
     * 
     * NOTE: We don't use Regex here for compatibility of browsers
     *       that don't support negative lookbehinds/aheads (e.g., Safari).
     *       
     * This algorithm is O(N) complexity. 
     */
    safe_substitute(sub_dict: {[key: string]: string}): string {
        let template = this.val;
        let prev_c = '';
        let group_start_idx = -1;
        for (let i = 0; i < template.length; i += 1) {
            const c = template.charAt(i);
            if (prev_c !== '\\') { // Skip escaped braces
                if (group_start_idx === -1 && c === '{')  // Identify the start of a capture {group}
                    group_start_idx = i;
                else if (group_start_idx > -1 && c === '}') {  // Identify the end of a capture {group}
                    if (group_start_idx + 1 < i) {  // Ignore {} empty braces
                        // We identified a capture group. First check if its key is in the substitution dict:
                        const varname = template.substring(group_start_idx+1, i);
                        if (varname in sub_dict) {
                            // Replace '{varname}' with the substitution value:
                            const replacement = sub_dict[varname];
                            template = template.substring(0, group_start_idx) + replacement + template.substring(i+1);
                            // Reset the iterator to point to the very next character upon the start of the next loop:
                            i = group_start_idx + replacement.length - 1;
                        }
                        // Because this is safe_substitute, we don't do anything if varname was not in sub_dict. 
                    }
                    group_start_idx = -1;
                }
            }
            prev_c = c;
        }
        return template;
    }

    /**
     * Returns true if the template string has:
     *   - at least one variable {}, if no varnames given
     *   - has at least one varname in passed varnames 
     */
    has_vars(varnames?: Array<string>): boolean {
        let template = this.val;
        let prev_c = '';
        let group_start_idx = -1;
        for (let i = 0; i < template.length; i += 1) {
            const c = template.charAt(i);
            if (prev_c !== '\\') { // Skip escaped braces
                if (group_start_idx === -1 && c === '{')  // Identify the start of a capture {group}
                    group_start_idx = i;
                else if (group_start_idx > -1 && c === '}') {  // Identify the end of a capture {group}
                    if (group_start_idx + 1 < i) {  // Ignore {} empty braces
                        if (varnames !== undefined) {
                            if (varnames.includes(template.substring(group_start_idx+1, i)))
                                return true;
                            // If varnames was specified but none matched this capture group, continue.
                        }
                        else {
                            return true;  // We identified a capture group.
                        }
                    }
                    group_start_idx = -1;
                }
            }
            prev_c = c;
        }
        return false;
    }

    /**
     * Finds all unfilled variables in the template string. 
     * 
     * For instance, if the string is "The {place} had {food}", 
     * then ["place", "food"] will be returned.
     */
    get_vars(): Array<string> {
        let template = this.val;
        let varnames: Array<string> = [];
        let prev_c = '';
        let group_start_idx = -1;
        for (let i = 0; i < template.length; i += 1) {
            const c = template.charAt(i);
            if (prev_c !== '\\') { // Skip escaped braces
                if (group_start_idx === -1 && c === '{')  // Identify the start of a capture {group}
                    group_start_idx = i;
                else if (group_start_idx > -1 && c === '}') {  // Identify the end of a capture {group}
                    if (group_start_idx + 1 < i)  // Ignore {} empty braces
                        varnames.push(template.substring(group_start_idx+1, i));
                    group_start_idx = -1;
                }
            }
            prev_c = c;
        }
        return varnames;
    }

    toString(): string {
        return this.val;
    }
}

export class PromptTemplate {
    /**
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
    */
    template: string; 
    fill_history: { [key: string]: any };
    metavars: { [key: string]: any };

    constructor(templateStr: string) {
        /** 
            Initialize a PromptTemplate with a string in string.Template format.
            (See https://docs.python.org/3/library/string.html#template-strings for more details.)

            NOTE: ChainForge only supports placeholders with braces {} without \ escape before them.
        */
        try {
            new StringTemplate(templateStr);
        } catch (err) {
            throw new Error(`Invalid template formatting for string: ${templateStr}`);
        }
    
        this.template = templateStr;
        this.fill_history = {};
        this.metavars = {};
    }

    /** Returns the value of this.template, with any escaped braces \{ and \} with the escape \ char removed. */
    toString(): string {
        return cleanEscapedBraces(this.template);
    }
    
    toValue(): string {
        return this.toString();
    }
    
    /** Returns True if the template has a variable with the given name. */
    has_var(varname: string): boolean {
        return (new StringTemplate(this.template).has_vars([varname]));
    }

    /** Returns True if no template variables are left in template string. */
    is_concrete(): boolean {
        return !(new StringTemplate(this.template).has_vars());
    }
    
    /** 
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
    */
    fill(paramDict: { [key: string]: any }): PromptTemplate {
        // Check for special 'past fill history' format:
        let past_fill_history = {};
        let past_metavars = {};
        let some_key = Object.keys(paramDict).pop();
        let some_val = some_key ? paramDict[some_key] : undefined;
        if (len(paramDict) > 0 && isDict(some_val)) {
            // Transfer over the fill history and metavars
            Object.values(paramDict).forEach(obj => {
                if ("fill_history" in obj)
                    past_fill_history = {...obj['fill_history'], ...past_fill_history}
                if ("metavars" in obj)
                    past_metavars = {...obj['metavars'], ...past_metavars}
            });

            // Recreate the param dict from just the 'text' property of the fill object
            let newParamDict: { [key: string]: any } = {};
            Object.entries(paramDict).forEach(([param, obj]) => {
                newParamDict[param] = obj['text'];
            });
            paramDict = newParamDict;
        }

        let filled_pt = new PromptTemplate(
            new StringTemplate(this.template).safe_substitute(paramDict)
        );

        // Deep copy prior fill history of this PromptTemplate from this version over to new one
        filled_pt.fill_history = JSON.parse(JSON.stringify(this.fill_history));
        filled_pt.metavars = JSON.parse(JSON.stringify(this.metavars));

        // Append any past history passed as vars:
        Object.entries(past_fill_history).forEach(([key, val]) => {
            if (key in filled_pt.fill_history)
                console.log(`Warning: PromptTemplate already has fill history for key ${key}.`);
            filled_pt.fill_history[key] = val;
        });
        
        // Append any metavars, overwriting existing ones with the same key
        Object.entries(past_metavars).forEach(([key, val]) => {
            filled_pt.metavars[key] = val;
        }); 

        // Add the new fill history using the passed parameters that we just filled in
        Object.entries(paramDict).forEach(([key, val]) => {
            if (key in filled_pt.fill_history)
                console.log(`Warning: PromptTemplate already has fill history for key ${key}.`);
            filled_pt.fill_history[key] = val;
        });
        
        return filled_pt;
    }

    /**
     * Fills in any 'special' variables with # before them, by using the passed fill_history dict. 
     * Modifies the prompt template in place.
     * @param fill_history A fill history dict. 
     */
    fill_special_vars(fill_history: {[key: string]: any}): void {
        // Special variables {#...} denotes filling a variable from a matching var in fill_history or metavars.
        // Find any special variables:
        const unfilled_vars = (new StringTemplate(this.template)).get_vars();
        let special_vars_to_fill: {[key: string]: string} = {};
        for (const v of unfilled_vars) {
            if (v.length > 0 && v[0] === '#') { // special template variables must begin with #
                const svar = v.substring(1);
                if (svar in fill_history)
                    special_vars_to_fill[v] = fill_history[svar];
                else
                    console.warn(`Could not find a value to fill special var ${v} in prompt template.`);
            }
        }
        // Fill any special variables, using the fill history of the template in question:
        if (Object.keys(special_vars_to_fill).length > 0)
            this.template = new StringTemplate(this.template).safe_substitute(special_vars_to_fill);
    }
}

export class PromptPermutationGenerator {
    /** 
    Given a PromptTemplate and a parameter dict that includes arrays of items, 
    generate all the permutations of the prompt for all permutations of the items.

    NOTE: Items can be in a special form: {text: <str>, fill_history: {varname: <str>}}
          in order to bundle in any past fill history that is lost in the current text.

    Example usage:
        prompt_gen = new PromptPermutationGenerator('Can you list all the cities in the country ${country} by the cheapest ${domain} prices?')
        for (let prompt of prompt_gen({"country":["Canada", "South Africa", "China"], 
                                  "domain": ["rent", "food", "energy"]})):
            console.log(prompt)
    */
    template: PromptTemplate;

    constructor(template: PromptTemplate | string) {
        if (typeof template === 'string')
            template = new PromptTemplate(template);
        this.template = template;
    }
    
    *_gen_perm(template: PromptTemplate, params_to_fill: Array<string>, paramDict: { [key: string]: any }): Generator<PromptTemplate, boolean, undefined> {
        if (len(params_to_fill) === 0) return true;

        // Extract the first param that occurs in the current template
        let param: string | undefined = undefined;
        let params_left: Array<string> = params_to_fill;
        for (let i = 0; i < params_to_fill.length; i++) {
            const p = params_to_fill[i];
            if (template.has_var(p)) {
                param = p;
                params_left = params_to_fill.filter(_p => _p !== p);
                break;
            }
        }   
        
        if (param === undefined) {
            yield template;
            return true;
        }

        // Generate new prompts by filling in its value(s) into the PromptTemplate
        let val = paramDict[param];
        let new_prompt_temps: Array<PromptTemplate> = [];
        if (Array.isArray(val)) {
            val.forEach(v => {
                if (param === undefined) return;

                let param_fill_dict: {[key: string]: any} = {};
                param_fill_dict[param] = v;

                /* If this var has an "associate_id", then it wants to "carry with"
                   values of other prompt parameters with the same id. 
                   We have to find any parameters with values of the same id, 
                   and fill them in alongside the initial parameter v: */
                if (isDict(v) && "associate_id" in v) {
                    let v_associate_id = v["associate_id"];
                    params_left.forEach(other_param => {
                        if (template.has_var(other_param) && Array.isArray(paramDict[other_param])) {
                            for (let i = 0; i < paramDict[other_param].length; i++) {
                                const ov = paramDict[other_param][i];
                                if (isDict(ov) && ov["associate_id"] === v_associate_id) {
                                    // This is a match. We should add the val to our param_fill_dict:
                                    param_fill_dict[other_param] = ov;
                                    break;
                                }
                            }
                        }
                    });
                }
                
                // Fill the template with the param values and append it to the list
                new_prompt_temps.push(template.fill(param_fill_dict));
            });  
        } 
        else if (typeof val === 'string') {
            let sub_dict: {[key: string]: any} = {};
            sub_dict[param] = val;
            new_prompt_temps = [template.fill(sub_dict)];
        } 
        else
            throw new Error("Value of prompt template parameter is not a list or a string, but of type " + (typeof val).toString());
        
        // Recurse
        if (len(params_left) === 0) {
            yield* new_prompt_temps;
        } else {
            for (let i = 0; i < new_prompt_temps.length; i++) {
                const p = new_prompt_temps[i];
                yield* this._gen_perm(p, params_left, paramDict);
            }
        }
        return true;
    }

    // Generator class method to yield permutations of a root prompt template
    *generate(paramDict: { [key: string]: any }): Generator<PromptTemplate, boolean, undefined> {
        let template = (typeof this.template === 'string') ? new PromptTemplate(this.template) : this.template;

        if (len(paramDict) === 0) {
            yield template;
            return true; // done
        }

        for (let p of this._gen_perm(template, Object.keys(paramDict), paramDict)) {
            p.fill_special_vars({...p.fill_history, ...p.metavars});

            // Yield the final prompt template
            yield p;
        }
        return true; // done
    }
}
