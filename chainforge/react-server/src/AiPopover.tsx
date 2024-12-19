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
  AIError,
  getAIFeaturesModels,
  generateAndReplaceTable,
} from "./backend/ai";
import { IconSparkles, IconAlertCircle } from "@tabler/icons-react";
import { AlertModalContext } from "./AlertModal";
import useStore from "./store";
import {
  INFO_CODEBLOCK_JS,
  INFO_CODEBLOCK_PY,
  INFO_EXAMPLE_JS,
  INFO_EXAMPLE_PY,
} from "./CodeEvaluatorNode";
import { queryLLM } from "./backend/backend";
import { splitText } from "./SplitNode";
import { escapeBraces } from "./backend/template";
import { cleanMetavarsFilterFunc } from "./backend/utils";
import {
  Dict,
  TabularDataColType,
  TabularDataRowType,
  VarsContext,
} from "./backend/typing";
import { v4 as uuidv4 } from "uuid";

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

// The generic popover button, a sparkly purple button that shows a popover with 'Generative AI' back on top.
// Extend for specific implementations .
export function AIPopover({
  // Pass the specific UI and logic for the popover as a child component
  children,
}: {
  children: React.ReactNode;
}) {
  // API keys
  const apiKeys = useStore((state) => state.apiKeys);
  const aiFeaturesProvider = useStore((state) => state.aiFeaturesProvider);

  // To check for provider selection and credentials/api keys
  const invalidAIFeaturesSetup = useMemo(() => {
    if (!aiFeaturesProvider) {
      return (
        <Alert
          variant="light"
          color="grape"
          title="No provider selected"
          mt="xs"
          maw={200}
          fz="xs"
          icon={<IconAlertCircle />}
        >
          You need to select a model in the settings to use this feature
        </Alert>
      );
    } else if (
      apiKeys &&
      aiFeaturesProvider.toLowerCase().includes("openai") &&
      !apiKeys.OpenAI
    ) {
      return (
        <Alert
          variant="light"
          color="grape"
          title="No OpenAI API key detected"
          mt="xs"
          maw={200}
          fz="xs"
          icon={<IconAlertCircle />}
        >
          You must set an OpenAI API key before you can use generative AI
          support features.
        </Alert>
      );
    } else if (
      apiKeys &&
      aiFeaturesProvider.toLowerCase().includes("bedrock") &&
      !(
        apiKeys.AWS_Access_Key_ID &&
        apiKeys.AWS_Secret_Access_Key &&
        apiKeys.AWS_Session_Token
      )
    ) {
      return (
        <Alert
          variant="light"
          color="grape"
          title="No AWS Credentials detected"
          mt="xs"
          maw={200}
          fz="xs"
          icon={<IconAlertCircle />}
        >
          You must set temporary AWS Credentials before you can use generative
          AI support features.
        </Alert>
      );
    }
    return undefined;
  }, [apiKeys, aiFeaturesProvider]);

  return (
    <Popover
      position="right-start"
      withArrow
      shadow={popoverShadow}
      withinPortal
      keepMounted
    >
      <Popover.Target>
        <button className="ai-button nodrag">
          <IconSparkles size={10} stroke={3} />
        </button>
      </Popover.Target>
      <Popover.Dropdown className="nodrag nowheel">
        <Stack style={zeroGap}>
          <Badge
            color="grape"
            variant="light"
            leftSection={<IconSparkles size={10} stroke={3} />}
          >
            Generative AI ({aiFeaturesProvider ?? "None"})
          </Badge>
          {invalidAIFeaturesSetup || children}
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
  // API keys and provider
  const apiKeys = useStore((state) => state.apiKeys);
  const aiFeaturesProvider = useStore((state) => state.aiFeaturesProvider);

  // Alert context
  const showAlert = useContext(AlertModalContext);

  // Command Fill state
  const [commandFillNumber, setCommandFillNumber] = useState<number>(5);
  const [isCommandFillLoading, setIsCommandFillLoading] = useState(false);
  const [didCommandFillError, setDidCommandFillError] = useState(false);

  // Generate and Replace state
  const [generateAndReplaceNumber, setGenerateAndReplaceNumber] = useState(5);
  const [generateAndReplacePrompt, setGenerateAndReplacePrompt] = useState("");
  const [didGenerateAndReplaceTableError, setDidGenerateAndReplaceTableError] =
    useState(false);

  // Generate Column state
  const [isGenerateColumnLoading, setIsGenerateColumnLoading] = useState(false);
  const [generateColumnPrompt, setGenerateColumnPrompt] = useState("");
  const [didGenerateColumnError, setDidGenerateColumnError] = useState(false);

  // Check if there are any non-empty rows
  const nonEmptyRows = useMemo(
    () =>
      values.filter((row) => Object.values(row).some((val) => val?.trim()))
        .length,
    [values],
  );

  // Check if there are enough rows to suggest autofilling
  const enoughRowsForSuggestions = useMemo(
    () => nonEmptyRows >= ROW_CONSTANTS.beginAutofilling,
    [nonEmptyRows],
  );

  const showWarning = useMemo(
    () => enoughRowsForSuggestions && nonEmptyRows < ROW_CONSTANTS.warnIfBelow,
    [enoughRowsForSuggestions, nonEmptyRows],
  );

  const handleGenerateAndReplaceTable = async () => {
    setDidGenerateAndReplaceTableError(false);
    setValuesLoading(true);

    try {
      // Fetch the generated table
      const generatedTable = await generateAndReplaceTable(
        generateAndReplacePrompt,
        generateAndReplaceNumber,
        aiFeaturesProvider,
        apiKeys,
      );

      const { cols, rows } = generatedTable;

      // Transform the result into TabularDataNode format
      const columns = cols.map((col, index) => ({
        key: `col-${index}`,
        header: col,
      }));

      const tabularRows = rows.map((row) => {
        const rowData: TabularDataRowType = { __uid: uuidv4() };
        cols.forEach((col, index) => {
          rowData[`col-${index}`] = row.split(" | ")[index]?.trim() || "";
        });
        return rowData;
      });

      // Update state with the transformed columns and rows
      onReplaceTable(columns, tabularRows);

      console.log("Generated table:", { columns, tabularRows });
    } catch (error) {
      console.error("Error in generateAndReplaceTable:", error);
      setDidGenerateAndReplaceTableError(true);
      showAlert && showAlert("An error occurred. Please try again.");
    } finally {
      setValuesLoading(false);
    }
  };

  const handleCommandFill = async () => {
    setIsCommandFillLoading(true);
    setDidCommandFillError(false);

    try {
      // Extract columns from the values, excluding the __uid column
      const tableColumns = colValues.map((col) => col.key);

      // Extract rows as strings, excluding the __uid column and handling empty rows
      const tableRows = values
        .slice(0, -1) // Remove the last empty row
        .map((row) =>
          tableColumns.map((col) => row[col]?.trim() || "").join(" | "),
        );

      const tableInput = {
        cols: tableColumns,
        rows: tableRows,
      };

      // Fetch new rows from the autofillTable function
      const result = await autofillTable(
        tableInput,
        commandFillNumber,
        aiFeaturesProvider,
        apiKeys,
      );

      // Transform result.rows into TabularDataNode format
      const newRows = result.rows.map((row) => {
        const newRow: TabularDataRowType = { __uid: uuidv4() };
        row.split(" | ").forEach((cell, index) => {
          newRow[`col-${index}`] = cell;
        });
        return newRow;
      });

      // Append the new rows to the existing rows
      onAddRows(newRows);
    } catch (error) {
      console.error("Error generating rows:", error);
      setDidCommandFillError(true);
      showAlert && showAlert("Failed to generate new rows. Please try again.");
    } finally {
      setIsCommandFillLoading(false);
    }
  };

  const handleGenerateColumn = async () => {
    setDidGenerateColumnError(false);
    setIsGenerateColumnLoading(true);

    try {
      // Extract columns from the values, excluding the __uid column
      const tableColumns = colValues;

      // Extract rows as strings, excluding the __uid column and handling empty rows
      const lastRow = values[values.length - 1]; // Get the last row
      const emptyLastRow = Object.values(lastRow).every((val) => !val); // Check if the last row is empty
      const tableRows = values
        .slice(0, emptyLastRow ? -1 : values.length)
        .map((row) =>
          tableColumns.map((col) => row[col.key]?.trim() || "").join(" | "),
        );

      const tableInput = {
        cols: tableColumns,
        rows: tableRows,
      };

      // Fetch the generated column
      const generatedColumn = await generateColumn(
        tableInput,
        generateColumnPrompt,
        aiFeaturesProvider,
        apiKeys,
      );

      const rowValues = generatedColumn.rows;

      // Append the new column to the existing columns
      onAddColumns(
        [{ key: `col-${tableColumns.length}`, header: generatedColumn.col }], // set key to length of columns
        rowValues,
      );
    } catch (error) {
      console.error("Error generating column:", error);
      setDidGenerateColumnError(true);
      showAlert &&
        showAlert("Failed to generate a new column. Please try again.");
    } finally {
      setIsGenerateColumnLoading(false);
    }
  };

  const extendUI = (
    <Stack>
      {didCommandFillError && (
        <Text size="xs" color="red">
          Failed to generate rows. Please try again.
        </Text>
      )}
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
          You may want to add more fields for better suggestions.
        </Text>
      )}
      <Divider label="OR" labelPosition="center" />
      {didGenerateColumnError && (
        <Text size="xs" color="red">
          Failed to generate column. Please try again.
        </Text>
      )}
      <Textarea
        label="Generate a column for..."
        value={generateColumnPrompt}
        onChange={(e) => setGenerateColumnPrompt(e.currentTarget.value)}
      />
      <Tooltip
        label="Can take awhile if you have many rows. Please be patient."
        withArrow
        position="bottom"
      >
        <Button
          size="sm"
          variant="light"
          color="grape"
          fullWidth
          onClick={handleGenerateColumn}
          disabled={!enoughRowsForSuggestions}
          loading={isGenerateColumnLoading}
        >
          Add Column
        </Button>
      </Tooltip>
    </Stack>
  );

  const replaceUI = (
    <Stack>
      {didGenerateAndReplaceTableError && (
        <Text size="xs" color="red">
          Failed to replace rows. Please try again.
        </Text>
      )}
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
        loading={areValuesLoading}
      >
        Replace
      </Button>
    </Stack>
  );

  return (
    <AIPopover>
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
  // API keys
  const apiKeys = useStore((state) => state.apiKeys);

  const aiFeaturesProvider = useStore((state) => state.aiFeaturesProvider);

  // Alerts
  const showAlert = useContext(AlertModalContext);

  // Command Fill state
  const [commandFillNumber, setCommandFillNumber] = useState<number>(3);
  const [isCommandFillLoading, setIsCommandFillLoading] = useState(false);
  const [didCommandFillError, setDidCommandFillError] = useState(false);

  // Generate and Replace state
  const [generateAndReplaceNumber, setGenerateAndReplaceNumber] = useState(3);
  const [generateAndReplacePrompt, setGenerateAndReplacePrompt] = useState("");
  const [genDiverseOutputs, setGenDiverseOutputs] = useState(false);
  const [didGenerateAndReplaceError, setDidGenerateAndReplaceError] =
    useState(false);

  const nonEmptyRows = useMemo(
    () => Object.values(values).filter((row) => row !== "").length,
    [values],
  );

  const enoughRowsForSuggestions = useMemo(
    () => nonEmptyRows >= ROW_CONSTANTS.beginAutofilling,
    [nonEmptyRows],
  );

  const showWarning = useMemo(
    () => enoughRowsForSuggestions && nonEmptyRows < ROW_CONSTANTS.warnIfBelow,
    [enoughRowsForSuggestions, nonEmptyRows],
  );

  const handleCommandFill = () => {
    setIsCommandFillLoading(true);
    setDidCommandFillError(false);
    autofill(
      Object.values(values),
      commandFillNumber,
      aiFeaturesProvider,
      apiKeys,
    )
      .then(onAddValues)
      .catch((e) => {
        if (e instanceof AIError) {
          setDidCommandFillError(true);
        } else {
          if (showAlert) showAlert(e?.message);
          else console.error(e);
        }
      })
      .finally(() => setIsCommandFillLoading(false));
  };

  const handleGenerateAndReplace = () => {
    setDidGenerateAndReplaceError(false);
    setValuesLoading(true);

    generateAndReplace(
      generateAndReplacePrompt,
      generateAndReplaceNumber,
      genDiverseOutputs,
      aiFeaturesProvider,
      apiKeys,
    )
      .then(onReplaceValues)
      .catch((e) => {
        if (e instanceof AIError) {
          console.log(e);
          setDidGenerateAndReplaceError(true);
        } else {
          if (showAlert) showAlert(e?.message);
          else console.error(e);
        }
      })
      .finally(() => setValuesLoading(false));
  };

  const extendUI = useMemo(
    () => (
      <Stack>
        {didCommandFillError ? (
          <Text size="xs" c="red">
            Failed to generate. Please try again.
          </Text>
        ) : (
          <></>
        )}
        <NumberInput
          label="Items to add"
          mt={5}
          min={1}
          max={10}
          defaultValue={3}
          value={commandFillNumber}
          onChange={(num) => {
            if (typeof num === "number") setCommandFillNumber(num);
          }}
        />
        {enoughRowsForSuggestions ? (
          <></>
        ) : (
          <Text size="xs" c="grape" maw={200}>
            You must enter at least {ROW_CONSTANTS.beginAutofilling} fields
            before extending.
          </Text>
        )}
        {showWarning ? (
          <Text size="xs" c="grape" maw={200}>
            You have less than {ROW_CONSTANTS.warnIfBelow} fields. You may want
            to add more. Adding more rows typically improves the quality of the
            suggestions.
          </Text>
        ) : (
          <></>
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
    ),
    [
      didCommandFillError,
      enoughRowsForSuggestions,
      showWarning,
      isCommandFillLoading,
      handleCommandFill,
      setCommandFillNumber,
      commandFillNumber,
    ],
  );

  const replaceUI = useMemo(
    () => (
      <Stack style={zeroGap}>
        {didGenerateAndReplaceError ? (
          <Text size="xs" c="red">
            Failed to generate. Please try again.
          </Text>
        ) : (
          <></>
        )}
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
          defaultValue={3}
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
          loading={areValuesLoading}
        >
          Replace
        </Button>
      </Stack>
    ),
    [
      didGenerateAndReplaceError,
      generateAndReplacePrompt,
      setGenerateAndReplacePrompt,
      generateAndReplaceNumber,
      setGenerateAndReplaceNumber,
      genDiverseOutputs,
      setGenDiverseOutputs,
      handleGenerateAndReplace,
      areValuesLoading,
    ],
  );

  return (
    <AIPopover>
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
  // API keys
  const apiKeys = useStore((state) => state.apiKeys);
  const aiFeaturesProvider = useStore((state) => state.aiFeaturesProvider);

  // State
  const [replacePrompt, setReplacePrompt] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const [awaitingResponse, setAwaitingResponse] = useState(false);

  // Alerts
  const showAlert = useContext(AlertModalContext);
  const [didEncounterError, setDidEncounterError] = useState(false);

  // Handle errors
  const handleError = useCallback(
    (err: string | Error) => {
      setAwaitingResponse(false);
      if (onLoadingChange) onLoadingChange(false);
      setDidEncounterError(true);
      if (typeof err !== "string") console.error(err);
      if (showAlert) showAlert(typeof err === "string" ? err : err?.message);
    },
    [setAwaitingResponse, onLoadingChange, setDidEncounterError, showAlert],
  );

  // Generate an evaluate function, given the user-specified prompt, in the proper programming language
  const handleGenerateEvalCode = useCallback(() => {
    setDidEncounterError(false);
    setAwaitingResponse(true);
    if (onLoadingChange) onLoadingChange(true);

    const context_str = buildContextPromptForVarsMetavars(context);

    const template = buildGenEvalCodePrompt(
      progLang,
      context_str,
      replacePrompt,
      false,
      false,
    );

    queryLLM(
      replacePrompt,
      getAIFeaturesModels(aiFeaturesProvider).large,
      1,
      escapeBraces(template),
      {},
      undefined,
      apiKeys,
      true,
    )
      .then((result) => {
        setAwaitingResponse(false);
        if (onLoadingChange) onLoadingChange(false);

        // Handle any errors when collecting the response
        if (result.errors && Object.keys(result.errors).length > 0)
          throw new Error(Object.values(result.errors)[0].toString());

        // Extract the first response
        const response = result.responses[0].responses[0] as string;
        console.log("LLM said: ", response);

        // Try to extract out a single code block from the response
        let code_blocks: string[] = splitText(response, "code", false);

        // Concat all found code blocks
        if (code_blocks.length > 0) {
          // Success! (we assume...)
          // If there's more than 1 code block, remove any others that also define an 'evaluate' function,
          // after the first appearance:
          const first_eval: number = code_blocks.findIndex((c) =>
            c.includes("evaluate(r"),
          );
          code_blocks = code_blocks.filter(
            (c, idx) => idx <= first_eval || !c.includes("evaluate(r"),
          );

          // We are using 2-space tabs but LLM outputs are generally 4-space tabs. Clean this up:
          const cleaned_code = changeFourSpaceTabsToTwo(
            code_blocks.join("\n\n"),
          );

          onGeneratedCode(cleaned_code);
        } else {
          // No code detected in response!
          setDidEncounterError(true);
        }
      })
      .catch(handleError);
  }, [
    progLang,
    onLoadingChange,
    onGeneratedCode,
    handleError,
    replacePrompt,
    context,
  ]);

  // Edit existing code according to user-specified instruction
  const handleEditCode = useCallback(() => {
    setDidEncounterError(false);
    setAwaitingResponse(true);
    if (onLoadingChange) onLoadingChange(true);

    const template = `Edit the code below according to the following: ${editPrompt}

You ${progLang === "javascript" ? "CANNOT import any external packages." : "can use imports if necessary. Do not include any type hints."}
Functions should only return boolean, numeric, or string values. Present the edited code in a single block.

Code:
\`\`\`${progLang}
${currentEvalCode}
\`\`\``;

    queryLLM(
      editPrompt,
      getAIFeaturesModels(aiFeaturesProvider).large,
      1,
      escapeBraces(template),
      {},
      undefined,
      apiKeys,
      true,
    )
      .then((result) => {
        setAwaitingResponse(false);
        if (onLoadingChange) onLoadingChange(false);

        // Handle any errors when collecting the response
        if (result.errors && Object.keys(result.errors).length > 0) {
          const first_err = Object.values(result.errors)[0];
          throw new Error(first_err.toString());
        }

        // Extract the first response
        const response = result.responses[0].responses[0] as string;
        console.log("LLM said: ", response);

        // Try to extract out a single code block from the response
        const code_blocks = splitText(response, "code", false);

        // Concat all found code blocks
        if (code_blocks.length > 0) {
          // Success! (we assume...)
          // We are using 2-space tabs but LLM outputs are generally 4-space tabs. Clean this up:
          const edited_code = changeFourSpaceTabsToTwo(
            code_blocks.join("\n\n"),
          );
          onGeneratedCode(edited_code);
        } else {
          // No code detected in response!
          setDidEncounterError(true);
        }
      })
      .catch(handleError);
  }, [
    progLang,
    onLoadingChange,
    onGeneratedCode,
    currentEvalCode,
    handleError,
    editPrompt,
    context,
  ]);

  return (
    <AIPopover>
      <Tabs color="grape" defaultValue="replace">
        <Tabs.List grow>
          <Tabs.Tab value="replace">Replace</Tabs.Tab>
          <Tabs.Tab value="edit">Edit</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="replace" pb="xs">
          <Stack style={zeroGap}>
            {didEncounterError ? (
              <Text size="xs" c="red">
                Failed to generate. Please try again.
              </Text>
            ) : (
              <></>
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
              loading={awaitingResponse}
            >
              Generate Code
            </Button>
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value="edit" pb="xs">
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
            loading={awaitingResponse}
          >
            Edit Code
          </Button>
        </Tabs.Panel>
      </Tabs>
    </AIPopover>
  );
}
