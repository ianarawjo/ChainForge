export class DuplicateVariableNameError extends Error {
    variable: string;

    constructor(variable: string) {
        super();
        this.name = "DuplicateVariableNameError";
        this.message = "Duplicate variable name, {" + variable + "}, in the same chain is not allowed.";
    }
}