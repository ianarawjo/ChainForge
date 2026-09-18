/**
 * Tools as the agent loop runs them: a spec the model sees, plus the code
 * that carries it out.
 */

import { JsonSchema, ToolSpec } from "../model/types";

export interface AgentTool extends ToolSpec {
  /**
   * Carries out the call. `args` has already been checked against
   * `parameters`. The result is sent to the model as JSON, or as-is if it's a
   * string. Throwing sends the error message to the model instead.
   */
  run(
    args: Record<string, unknown>,
    context: { signal?: AbortSignal },
  ): Promise<unknown> | unknown;
}

/**
 * Problems with a value against a JSON Schema, as short sentences a model can
 * act on. Covers only the parts of JSON Schema that tool specs here use:
 * types, required properties, nested properties and items, and enums.
 * Properties the schema doesn't mention are allowed.
 */
export function schemaProblems(
  value: unknown,
  schema: JsonSchema,
  path = "arguments",
): string[] {
  if (schema.type && !hasType(value, schema.type))
    return [`${path} should be ${article(schema.type)} ${schema.type}.`];

  if (schema.enum && !schema.enum.includes(value as string | number))
    return [
      `${path} should be one of: ${schema.enum.map((e) => JSON.stringify(e)).join(", ")}.`,
    ];

  const problems: string[] = [];
  if (schema.type === "object" && isPlainObject(value)) {
    for (const key of schema.required ?? [])
      if (value[key] === undefined) problems.push(`${path}.${key} is missing.`);
    for (const [key, sub] of Object.entries(schema.properties ?? {}))
      if (value[key] !== undefined)
        problems.push(...schemaProblems(value[key], sub, `${path}.${key}`));
  }
  if (schema.type === "array" && Array.isArray(value) && schema.items) {
    const items = schema.items;
    value.forEach((item, i) =>
      problems.push(...schemaProblems(item, items, `${path}[${i}]`)),
    );
  }
  return problems;
}

function hasType(value: unknown, type: NonNullable<JsonSchema["type"]>) {
  switch (type) {
    case "object":
      return isPlainObject(value);
    case "array":
      return Array.isArray(value);
    case "integer":
      return Number.isInteger(value);
    case "number":
      return typeof value === "number" && !isNaN(value);
    default:
      return typeof value === type;
  }
}

export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function article(word: string) {
  return /^[aeiou]/.test(word) ? "an" : "a";
}
