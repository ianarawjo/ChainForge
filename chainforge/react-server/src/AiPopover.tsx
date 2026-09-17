import React, { useCallback, useContext, useMemo, useState } from "react";
import {
  Stack,
  NumberInput,
  Button,
  Text,
  Switch,
  Tabs,
  Popover,
  Badge,
  Textarea,
  Alert,
  Divider,
  Tooltip,
} from "@mantine/core";
import {
  autofill,
  autofillTable,
  generateColumn,
  generateAndReplace,
  generateAndReplaceTable,
  queryAI,
} from "./backend/ai";
import { IconSparkles, IconAlertCircle } from "@tabler/icons-react";
import { AlertModalContext } from "./AlertModal";
import useAIFeatures from "./useAIFeatures";
import {
  INFO_CODEBLOCK_JS,
  INFO_CODEBLOCK_PY,
  INFO_EXAMPLE_JS,
  INFO_EXAMPLE_PY,
} from "./CodeEvaluatorNode";
import { splitText } from "./SplitNode";
import { cleanMetavarsFilterFunc } from "./backend/utils";
import {
  Dict,
  LLMSpec,
  TabularDataColType,
  TabularDataRowType,
  VarsContext,
} from "./backend/typing";
import { v4 as uuidv4 } from "uuid";
import { StringLookup } from "./backend/cache";

const zeroGap = { gap: "0rem" };
const popoverShadow = "rgb(38, 57, 77) 0px 10px 30px -14px";

const ROW_CONSTANTS = {
  beginAutofilling: 1,
  warnIfBelow: 2,
};

const changeFourSpaceTabsToTwo = (code: string) => {
  const lines = code.split("\n");
  const retabbed_lines: string[] = [];
  function countLeadingSpaces(str: string) {
    const match = str.match(/^ */);
    return match ? match[0].length : 0;
  }

  // First we need to check what format the code is in.
  // It could be 2-space tabs already, in which case we'll just return it as-is:
  const leadingSpaces = lines.map(countLeadingSpaces);
  if (leadingSpaces.some((n) => n === 2))
    // if any line has exactly 2 spaces to begin it
    return code;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const num_leading_spaces = leadingSpaces[i];
    if (num_leading_spaces >= 3)
      retabbed_lines.push(
        "  ".repeat(Math.floor(num_leading_spaces / 4)) +
          line.substring(num_leading_spaces),
      );
    else retabbed_lines.push(line);
  }
  return retabbed_lines.join("\n");
};

export const buildGenEvalCodePrompt = (
  progLang: "python" | "javascript",
  context: string,
  specPrompt: string,
  manyFuncs?: boolean,
  onlyBooleanFuncs?: boolean,
) => `You are to generate ${manyFuncs ? "many different functions" : "one function"} to evaluate textual data, given a user-specified specification.
The function${manyFuncs ? "s" : ""} will be mapped over an array of objects of type ResponseInfo.
${manyFuncs ? "Each" : "Your"} solution must contain a single function called 'evaluate' that takes a single object, 'r', of type ResponseInfo. A ResponseInfo is defined as:

\`\`\`${progLang === "javascript" ? INFO_CODEBLOCK_JS : INFO_CODEBLOCK_PY}\`\`\`

For instance, here is an evaluator that returns the length of a response:

\`\`\`${progLang === "javascript" ? INFO_EXAMPLE_JS : INFO_EXAMPLE_PY}\`\`\`

You can only write in ${progLang.charAt(0).toUpperCase() + progLang.substring(1)}.
You ${progLang === "javascript" ? 'CANNOT import any external packages, and always use "let" to define variables instead of "var".' : "can use imports if necessary. Do not include any type hints."}
Your function${manyFuncs ? "s" : ""} can ONLY return ${onlyBooleanFuncs ? "boolean" : "boolean, numeric, or string"} values.
${context}
Here is the user's specification:

${specPrompt}`;

// Builds part of a longer prompt to the LLM about the shape of Response objects
// input into an evaluator (the names of template vars, and available metavars)
export const buildContextPromptForVarsMetavars = (context: VarsContext) => {
  if (!context) return "";

  const promptify_key_arr = (arr: string[]) => {
    if (arr.length === 1) return `with the key "${arr[0]}"`;
    else return "with the keys " + arr.map((s) => `"${s}"`).join(", ");
  };

  let context_str = "";
  const metavars =
    "metavars" in context
      ? context.metavars.filter(cleanMetavarsFilterFunc)
      : [];
  const has_vars = "vars" in context && context.vars.length > 0;
  const has_metavars = metavars && metavars.length > 0;
  const has_context = has_vars || has_metavars;
  if (has_context) context_str = "\nThe ResponseInfo instances have ";
  if (has_vars) {
    context_str += "var dictionaries " + promptify_key_arr(context.vars);
    if (has_metavars) context_str += " and ";
  }
  if (has_metavars) {
    context_str += "meta dictionaries " + promptify_key_arr(metavars);
  }
  if (has_context) context_str += ".\n";

  return context_str;
};

/** The message to show users for an error from an AI feature. */
const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : String(err);

/** The model name to show users, without the provider name before it. */
const displayModelName = (model: LLMSpec) =>
  model.name.substring(model.name.indexOf(" ") + 1);

// The generic popover button, a sparkly purple button that shows a popover with 'Generative AI' back on top.
// Extend for specific implementations .
export function AIPopover({
  // Pass the specific UI and logic for the popover as a child component
  children,
  // The model the popover's features query, shown to users
  model,
}: {
  children: React.ReactNode;
  model: LLMSpec;
}) {
  const [opened, setOpened] = useState(false);
  const { provider, setupProblem } = useAIFeatures();

  return (
    <Popover
      position="right-start"
      withArrow
      shadow={popoverShadow}
      withinPortal
      keepMounted
      opened={opened}
      onChange={setOpened}
      clickOutsideEvents={["click"]}
    >
      <Popover.Target>
        <button
          className="ai-button nodrag"
          onClick={() => setOpened((o) => !o)}
        >
          <IconSparkles size={10} fill="violet" />
        </button>
      </Popover.Target>
      <Popover.Dropdown className="nodrag nowheel">
        <Stack style={zeroGap} maw={260}>
          <Tooltip
            label={`Uses ${displayModelName(model)} via ${provider.name}. Change this in Settings.`}
            withinPortal
            multiline
            maw={220}
          >
            <Badge
              color="grape"
              variant="light"
              leftSection={<IconSparkles size={10} stroke={3} />}
            >
              Generative AI ({provider.name})
            </Badge>
          </Tooltip>
          {setupProblem ? (
            <Alert
              variant="light"
              color="grape"
              title="AI features need setting up"
              mt="xs"
              fz="xs"
              icon={<IconAlertCircle />}
            >
              {setupProblem}
            </Alert>
          ) : (
            children
          )}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

export interface AIGenReplaceTablePopoverProps {
  // Values in the rows of the table's columns
  values: TabularDataRowType[];
  // Names of the table's columns
  colValues: TabularDataColType[];
  // Function to add new rows
  onAddRows: (newRows: TabularDataRowType[]) => void;
  // Function to replace the table
  onReplaceTable: (
    columns: TabularDataColType[],
    rows: TabularDataRowType[],
  ) => void;
  // Function to add new columns
  onAddColumns: (
    newColumns: TabularDataColType[],
    rowValues?: string[], // Optional row values
  ) => void;
  // Indicates if values are loading
  areValuesLoading: boolean;
  // Callback to set loading state
  setValuesLoading: (isLoading: boolean) => void;
}

/**
 * AI Popover UI for TablularData nodes
 */
export function AIGenReplaceTablePopover({
  values,
  colValues,
  onAddRows,
  onReplaceTable,
  onAddColumns,
  areValuesLoading,
  setValuesLoading,
}: AIGenReplaceTablePopoverProps) {
  const { fastModel, apiKeys } = useAIFeatures();

  // Alert context
  const showAlert = useContext(AlertModalContext);

  // Command Fill state
  const [commandFillNumber, setCommandFillNumber] = useState<number>(5);
  const [isCommandFillLoading, setIsCommandFillLoading] = useState(false);

  // Generate and Replace state
  const [generateAndReplaceNumber, setGenerateAndReplaceNumber] = useState(5);
  const [generateAndReplacePrompt, setGenerateAndReplacePrompt] = useState("");

  // Generate Column state
  const [isGenerateColumnLoading, setIsGenerateColumnLoading] = useState(false);
  const [generateColumnPrompt, setGenerateColumnPrompt] = useState("");

  // The table's non-empty rows, as the text of each cell in column order
  const nonEmptyRows = useMemo(
    () =>
      values
        .map((row) =>
          colValues.map((col) => StringLookup.get(row[col.key])?.trim() ?? ""),
        )
        .filter((cells) => cells.some((cell) => cell.length > 0)),
    [values, colValues],
  );

  // Check if there are enough rows to suggest autofilling
  const enoughRowsForSuggestions =
    nonEmptyRows.length >= ROW_CONSTANTS.beginAutofilling;
  const showWarning =
    enoughRowsForSuggestions && nonEmptyRows.length < ROW_CONSTANTS.warnIfBelow;

  const handleError = (err: unknown) => {
    console.error(err);
    if (showAlert) showAlert(errorMessage(err));
  };

  const handleGenerateAndReplaceTable = async () => {
    setValuesLoading(true);
    try {
      const { cols, rows } = await generateAndReplaceTable(
        generateAndReplacePrompt,
        generateAndReplaceNumber,
        fastModel,
        apiKeys,
      );
      const columns = cols.map((col, index) => ({
        key: `col-${index}`,
        header: col,
      }));
      const tabularRows = rows.map((cells) => {
        const rowData: TabularDataRowType = { __uid: uuidv4() };
        columns.forEach((col, index) => {
          rowData[col.key] = cells[index] ?? "";
        });
        return rowData;
      });
      onReplaceTable(columns, tabularRows);
    } catch (err) {
      handleError(err);
    } finally {
      setValuesLoading(false);
    }
  };

  const handleCommandFill = async () => {
    setIsCommandFillLoading(true);
    try {
      const rows = await autofillTable(
        { cols: colValues.map((col) => col.header), rows: nonEmptyRows },
        commandFillNumber,
        fastModel,
        apiKeys,
      );
      // The table maps these positional keys onto its own column keys
      onAddRows(
        rows.map((cells) => {
          const newRow: TabularDataRowType = { __uid: uuidv4() };
          cells.forEach((cell, index) => {
            newRow[`col-${index}`] = cell;
          });
          return newRow;
        }),
      );
    } catch (err) {
      handleError(err);
    } finally {
      setIsCommandFillLoading(false);
    }
  };

  const handleGenerateColumn = async () => {
    setIsGenerateColumnLoading(true);
    try {
      // Every row but a trailing empty one, so values line up with the table's rows
      const lastRow = values[values.length - 1];
      const emptyLastRow =
        lastRow !== undefined &&
        colValues.every((col) => !StringLookup.get(lastRow[col.key])?.trim());
      const rows = values
        .slice(0, emptyLastRow ? -1 : values.length)
        .map((row) =>
          colValues.map((col) => StringLookup.get(row[col.key])?.trim() ?? ""),
        );

      const generatedColumn = await generateColumn(
        { cols: colValues.map((col) => col.header), rows },
        generateColumnPrompt,
        fastModel,
        apiKeys,
      );
      onAddColumns(
        [{ key: `col-${uuidv4()}`, header: generatedColumn.col }],
        generatedColumn.rows,
      );
    } catch (err) {
      handleError(err);
    } finally {
      setIsGenerateColumnLoading(false);
    }
  };

  const extendUI = (
    <Stack>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <NumberInput
          label="Rows to add"
          mt={5}
          min={1}
          max={10}
          value={commandFillNumber}
          onChange={(num) => setCommandFillNumber(num || 1)}
          style={{ flex: 1 }}
        />
        <Button
          size="sm"
          variant="light"
          color="grape"
          onClick={handleCommandFill}
          disabled={!enoughRowsForSuggestions}
          loading={isCommandFillLoading}
          style={{ marginTop: "1.5rem", flex: 1 }}
        >
          Extend
        </Button>
      </div>
      {showWarning && (
        <Text size="xs" color="grape">
          You may want to add more rows for better suggestions.
        </Text>
      )}
      <Divider label="OR" labelPosition="center" />
      <Textarea
        label="Generate a column for..."
        value={generateColumnPrompt}
        onChange={(e) => setGenerateColumnPrompt(e.currentTarget.value)}
      />
      <Tooltip
        label="Queries the model once per row."
        withArrow
        position="bottom"
      >
        <Button
          size="sm"
          variant="light"
          color="grape"
          fullWidth
          onClick={handleGenerateColumn}
          disabled={!enoughRowsForSuggestions || !generateColumnPrompt.trim()}
          loading={isGenerateColumnLoading}
        >
          Add Column
        </Button>
      </Tooltip>
    </Stack>
  );

  const replaceUI = (
    <Stack>
      <Textarea
        label="Generate data for..."
        value={generateAndReplacePrompt}
        onChange={(e) => setGenerateAndReplacePrompt(e.currentTarget.value)}
      />
      <NumberInput
        label="Rows to generate"
        min={1}
        max={50}
        value={generateAndReplaceNumber}
        onChange={(num) => setGenerateAndReplaceNumber(num || 1)}
      />
      <Button
        size="sm"
        variant="light"
        color="grape"
        fullWidth
        onClick={handleGenerateAndReplaceTable}
        disabled={!generateAndReplacePrompt.trim()}
        loading={areValuesLoading}
      >
        Replace
      </Button>
    </Stack>
  );

  return (
    <AIPopover model={fastModel}>
      <Tabs color="grape" defaultValue="replace">
        <Tabs.List grow>
          <Tabs.Tab value="replace">Replace</Tabs.Tab>
          <Tabs.Tab value="extend">Extend</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="extend" pb="xs">
          {extendUI}
        </Tabs.Panel>
        <Tabs.Panel value="replace" pb="xs">
          {replaceUI}
        </Tabs.Panel>
      </Tabs>
    </AIPopover>
  );
}

export interface AIGenReplaceItemsPopoverProps {
  // Strings for the Extend feature to use as a basis.
  values: Dict<string> | string[];
  // A function that takes a list of strings that the popover will call to add new values
  onAddValues: (newVals: string[]) => void;
  // A function that takes a list of strings that the popover will call to replace the existing values
  onReplaceValues: (newVals: string[]) => void;
  // A boolean that indicates whether the values are in a loading state
  areValuesLoading: boolean;
  // A function that takes a boolean that the popover will call to indicate values are loading (true) or finished (false)
  setValuesLoading: (isLoading: boolean) => void;
}

/**
 * AI Popover UI for TextFields and Items nodes
 */
export function AIGenReplaceItemsPopover({
  values,
  onAddValues,
  onReplaceValues,
  areValuesLoading,
  setValuesLoading,
}: AIGenReplaceItemsPopoverProps) {
  const { fastModel, apiKeys } = useAIFeatures();

  // Alerts
  const showAlert = useContext(AlertModalContext);

  // Command Fill state
  const [commandFillNumber, setCommandFillNumber] = useState<number>(3);
  const [isCommandFillLoading, setIsCommandFillLoading] = useState(false);

  // Generate and Replace state
  const [generateAndReplaceNumber, setGenerateAndReplaceNumber] = useState(3);
  const [generateAndReplacePrompt, setGenerateAndReplacePrompt] = useState("");
  const [genDiverseOutputs, setGenDiverseOutputs] = useState(false);

  const nonEmptyRows = useMemo(
    () => Object.values(values).filter((row) => row !== "").length,
    [values],
  );

  const enoughRowsForSuggestions =
    nonEmptyRows >= ROW_CONSTANTS.beginAutofilling;
  const showWarning =
    enoughRowsForSuggestions && nonEmptyRows < ROW_CONSTANTS.warnIfBelow;

  const handleError = useCallback(
    (err: unknown) => {
      console.error(err);
      if (showAlert) showAlert(errorMessage(err));
    },
    [showAlert],
  );

  const handleCommandFill = useCallback(() => {
    setIsCommandFillLoading(true);
    autofill(Object.values(values), commandFillNumber, fastModel, apiKeys)
      .then(onAddValues)
      .catch(handleError)
      .finally(() => setIsCommandFillLoading(false));
  }, [values, commandFillNumber, fastModel, apiKeys, onAddValues, handleError]);

  const handleGenerateAndReplace = useCallback(() => {
    setValuesLoading(true);
    generateAndReplace(
      generateAndReplacePrompt,
      generateAndReplaceNumber,
      genDiverseOutputs,
      fastModel,
      apiKeys,
    )
      .then(onReplaceValues)
      .catch(handleError)
      .finally(() => setValuesLoading(false));
  }, [
    generateAndReplacePrompt,
    generateAndReplaceNumber,
    genDiverseOutputs,
    fastModel,
    apiKeys,
    onReplaceValues,
    setValuesLoading,
    handleError,
  ]);

  const extendUI = (
    <Stack>
      <NumberInput
        label="Items to add"
        mt={5}
        min={1}
        max={10}
        value={commandFillNumber}
        onChange={(num) => {
          if (typeof num === "number") setCommandFillNumber(num);
        }}
      />
      {!enoughRowsForSuggestions && (
        <Text size="xs" c="grape" maw={200}>
          You must enter at least {ROW_CONSTANTS.beginAutofilling} fields before
          extending.
        </Text>
      )}
      {showWarning && (
        <Text size="xs" c="grape" maw={200}>
          You have less than {ROW_CONSTANTS.warnIfBelow} fields. Adding more
          typically improves the quality of the suggestions.
        </Text>
      )}
      <Button
        size="sm"
        variant="light"
        color="grape"
        fullWidth
        onClick={handleCommandFill}
        disabled={!enoughRowsForSuggestions}
        loading={isCommandFillLoading}
      >
        Extend
      </Button>
    </Stack>
  );

  const replaceUI = (
    <Stack style={zeroGap}>
      <Textarea
        label="Generate a list of..."
        size="sm"
        data-autofocus
        minRows={1}
        maxRows={4}
        autosize
        mt={5}
        value={generateAndReplacePrompt}
        onChange={(e) => setGenerateAndReplacePrompt(e.currentTarget.value)}
      />
      <NumberInput
        label="Items to generate"
        size="xs"
        mb={10}
        min={1}
        max={10}
        value={generateAndReplaceNumber}
        onChange={(num) => {
          if (typeof num === "number") setGenerateAndReplaceNumber(num);
        }}
      />
      <Switch
        color="grape"
        mb={10}
        size="xs"
        label="Make outputs unconventional"
        checked={genDiverseOutputs}
        onChange={(e) => setGenDiverseOutputs(e.currentTarget.checked)}
      />
      <Button
        size="sm"
        variant="light"
        color="grape"
        fullWidth
        onClick={handleGenerateAndReplace}
        disabled={!generateAndReplacePrompt.trim()}
        loading={areValuesLoading}
      >
        Replace
      </Button>
    </Stack>
  );

  return (
    <AIPopover model={fastModel}>
      <Tabs color="grape" defaultValue="replace">
        <Tabs.List grow>
          <Tabs.Tab value="replace">Replace</Tabs.Tab>
          <Tabs.Tab value="extend">Extend</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="extend" pb="xs">
          {extendUI}
        </Tabs.Panel>
        <Tabs.Panel value="replace" pb="xs">
          {replaceUI}
        </Tabs.Panel>
      </Tabs>
    </AIPopover>
  );
}

/**
 * Asks a model for code, returning the code blocks in its reply, joined and
 * retabbed to 2 spaces, or undefined if it wrote none.
 * @param onlyFirstEvaluate Drops any later blocks that define another 'evaluate' function.
 */
async function generateCode(
  model: LLMSpec,
  prompt: string,
  apiKeys: Dict,
  onlyFirstEvaluate: boolean,
): Promise<string | undefined> {
  const reply = await queryAI(model, prompt, { apiKeys });
  let codeBlocks: string[] = splitText(reply, "code", false);
  if (codeBlocks.length === 0) return undefined;
  if (onlyFirstEvaluate) {
    const firstEval = codeBlocks.findIndex((c) => c.includes("evaluate(r"));
    codeBlocks = codeBlocks.filter(
      (c, idx) => idx <= firstEval || !c.includes("evaluate(r"),
    );
  }
  // LLM outputs are generally 4-space tabs, but we use 2-space tabs
  return changeFourSpaceTabsToTwo(codeBlocks.join("\n\n"));
}

export interface AIGenCodeEvaluatorPopoverProps {
  // The programming language to generate evaluation code in (currently, only 'python' or 'javascript')
  progLang: "python" | "javascript";
  // Callback when the AI has returned code to put in the evaluator's text editor
  onGeneratedCode: (code: string) => void;
  // Callback that takes a boolean that the popover will call to set whether the values are loading and are done loading
  onLoadingChange: (isLoading: boolean) => void;
  // The keys available in vars and metavar dicts, for added context to the LLM
  context: VarsContext;
  // The code currently in the evaluator
  currentEvalCode: string;
}

/**
 * AI Popover UI for code evaluators.
 */
export function AIGenCodeEvaluatorPopover({
  progLang,
  onGeneratedCode,
  onLoadingChange,
  context,
  currentEvalCode,
}: AIGenCodeEvaluatorPopoverProps) {
  const { smartModel, apiKeys } = useAIFeatures();

  // State
  const [replacePrompt, setReplacePrompt] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const [awaitingResponse, setAwaitingResponse] = useState(false);

  // Alerts
  const showAlert = useContext(AlertModalContext);
  const [didEncounterError, setDidEncounterError] = useState(false);

  // Queries the model for code, putting it in the editor
  const runCodeQuery = useCallback(
    (prompt: string, onlyFirstEvaluate: boolean) => {
      setDidEncounterError(false);
      setAwaitingResponse(true);
      if (onLoadingChange) onLoadingChange(true);

      generateCode(smartModel, prompt, apiKeys, onlyFirstEvaluate)
        .then((code) => {
          if (code !== undefined) onGeneratedCode(code);
          // No code detected in the response
          else setDidEncounterError(true);
        })
        .catch((err) => {
          console.error(err);
          setDidEncounterError(true);
          if (showAlert) showAlert(errorMessage(err));
        })
        .finally(() => {
          setAwaitingResponse(false);
          if (onLoadingChange) onLoadingChange(false);
        });
    },
    [smartModel, apiKeys, onLoadingChange, onGeneratedCode, showAlert],
  );

  // Generate an evaluate function, given the user-specified prompt, in the proper programming language
  const handleGenerateEvalCode = useCallback(() => {
    const prompt = buildGenEvalCodePrompt(
      progLang,
      buildContextPromptForVarsMetavars(context),
      replacePrompt,
      false,
      false,
    );
    runCodeQuery(prompt, true);
  }, [progLang, context, replacePrompt, runCodeQuery]);

  // Edit existing code according to user-specified instruction
  const handleEditCode = useCallback(() => {
    const prompt = `Edit the code below according to the following: ${editPrompt}

You ${progLang === "javascript" ? "CANNOT import any external packages." : "can use imports if necessary. Do not include any type hints."}
Functions should only return boolean, numeric, or string values. Present the edited code in a single block.

Code:
\`\`\`${progLang}
${currentEvalCode}
\`\`\``;
    runCodeQuery(prompt, false);
  }, [progLang, editPrompt, currentEvalCode, runCodeQuery]);

  return (
    <AIPopover model={smartModel}>
      <Tabs color="grape" defaultValue="replace">
        <Tabs.List grow>
          <Tabs.Tab value="replace">Replace</Tabs.Tab>
          <Tabs.Tab value="edit">Edit</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="replace" pb="xs">
          <Stack style={zeroGap}>
            {didEncounterError && (
              <Text size="xs" c="red">
                Failed to generate. Please try again.
              </Text>
            )}
            <Textarea
              label="Describe what to evaluate:"
              description="Generated code replaces existing code."
              size="sm"
              data-autofocus
              minRows={2}
              maxRows={4}
              autosize
              mt={5}
              value={replacePrompt}
              onChange={(e) => setReplacePrompt(e.currentTarget.value)}
            />
            <Button
              size="sm"
              variant="light"
              color="grape"
              mt="sm"
              fullWidth
              onClick={handleGenerateEvalCode}
              disabled={!replacePrompt.trim()}
              loading={awaitingResponse}
            >
              Generate Code
            </Button>
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value="edit" pb="xs">
          {didEncounterError && (
            <Text size="xs" c="red">
              Failed to edit. Please try again.
            </Text>
          )}
          <Textarea
            label="Describe how to edit existing code:"
            description="Describe what to change in the code."
            size="sm"
            data-autofocus
            minRows={2}
            maxRows={4}
            autosize
            mt={5}
            value={editPrompt}
            onChange={(e) => setEditPrompt(e.currentTarget.value)}
          />
          <Button
            size="sm"
            variant="light"
            color="grape"
            mt="sm"
            fullWidth
            onClick={handleEditCode}
            disabled={!editPrompt.trim()}
            loading={awaitingResponse}
          >
            Edit Code
          </Button>
        </Tabs.Panel>
      </Tabs>
    </AIPopover>
  );
}
