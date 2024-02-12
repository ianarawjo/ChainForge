export class DuplicateVariableNameError extends Error {
  variable: string;

  constructor(variable: string) {
    super();
    this.name = "DuplicateVariableNameError";
    this.message =
      "You have multiple template variables with the same name, {" +
      variable +
      "}. Duplicate names in the same chain is not allowed. To fix, ensure that all template variable names are unique across a chain.";
  }
}

export class UserForcedPrematureExit extends Error {
  constructor(id?: string) {
    super();
    this.name = "UserForcedPrematureExit";
    this.message =
      "You have forced the premature exit of the process" +
      (id !== undefined ? ` with id ${id}` : "");
  }
}
