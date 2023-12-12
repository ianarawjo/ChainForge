import { ErrorBase } from "./utils";

type ErrorName = 
    | 'DUPLICATE_VARIABLE_NAME'

export class ProjectError extends ErrorBase<ErrorName> {}