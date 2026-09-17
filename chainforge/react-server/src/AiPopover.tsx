import React, {
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
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
  Progress,
  Flex,
} from "@mantine/core";
import {
  autofill,
  autofillTable,
  generateColumn,
  generateAndReplace,
  generateAndReplaceTable,
  generatePromptVariants,
  generateRubric,
  generateTestQuestions,
  AIDocument,
  AIProgress,
  queryAI,
  dropRepeatedDefinitions,
  RubricFormat,
  TEST_QUESTION_COLUMNS,
} from "./backend/ai";
import {
  IconSparkles,
  IconAlertCircle,
  IconArrowBackUp,
} from "@tabler/icons-react";
import { AlertModalContext } from "./AlertModal";
import useAIFeatures from "./useAIFeatures";
import useUndoAIOverwrite from "./useUndoAIOverwrite";
import {
  INFO_CODEBLOCK_JS,
  INFO_CODEBLOCK_PY,
  INFO_EXAMPLE_JS,
  INFO_EXAMPLE_PY,
  INFO_PROC_EXAMPLE_JS,
  INFO_PROC_EXAMPLE_PY,
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
import CancelTracker from "./backend/canceler";

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

/** The prompt to write a processor's 'process' function, from the user's description. */
export const buildGenProcessorCodePrompt = (
  progLang: "python" | "javascript",
  context: string,
  specPrompt: string,
) => `You are to generate one function to transform textual data, given a user-specified specification.
The function will be mapped over an array of objects of type ResponseInfo, and its return value replaces the text of each one.
Your solution must contain a single function called 'process' that takes a single object, 'r', of type ResponseInfo. A ResponseInfo is defined as:

\`\`\`${progLang === "javascript" ? INFO_CODEBLOCK_JS : INFO_CODEBLOCK_PY}\`\`\`

For instance, here is a processor that returns the first 12 characters of a response:

\`\`\`${progLang === "javascript" ? INFO_PROC_EXAMPLE_JS : INFO_PROC_EXAMPLE_PY}\`\`\`

You can only write in ${progLang.charAt(0).toUpperCase() + progLang.substring(1)}.
You ${progLang === "javascript" ? 'CANNOT import any external packages, and always use "let" to define variables instead of "var".' : "can use imports if necessary. Do not include any type hints."}
Your function can ONLY return string or numeric values: the transformed text.
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
  // Style overrides for the button, e.g. outside a node's header
  buttonStyle,
  // Called when the popover opens
  onOpen,
}: {
  // Or a function that takes a callback to close the popover
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
  model: LLMSpec;
  buttonStyle?: React.CSSProperties;
  onOpen?: () => void;
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
          style={buttonStyle}
          onClick={() => {
            if (!opened && onOpen) onOpen();
            setOpened((o) => !o);
          }}
        >
          <IconSparkles size={13} stroke={1.8} />
        </button>
      </Popover.Target>
      <Popover.Dropdown className="nodrag nowheel">
        <Stack style={zeroGap} maw={300}>
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
          ) : typeof children === "function" ? (
            children(() => setOpened(false))
          ) : (
            children
          )}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

/** The button for undoing an AI change, shown under the popover's tabs. */
function UndoAIOverwriteButton({
  label,
  onUndo,
}: {
  label: string;
  onUndo: () => void;
}) {
  return (
    <Button
      size="xs"
      variant="subtle"
      color="gray"
      fullWidth
      leftIcon={<IconArrowBackUp size={14} />}
      onClick={onUndo}
    >
      {label}
    </Button>
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
  // The documents (or chunks) connected to the table's input, if any
  getDocuments?: () => AIDocument[];
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
  getDocuments,
}: AIGenReplaceTablePopoverProps) {
  const { fastModel, apiKeys } = useAIFeatures();

  // Undo for Replace and From docs, which replace the whole table
  const restoreTable = useCallback(
    (before: { columns: TabularDataColType[]; rows: TabularDataRowType[] }) =>
      onReplaceTable(before.columns, before.rows),
    [onReplaceTable],
  );
  const undoReplace = useUndoAIOverwrite(
    { columns: colValues, rows: values },
    restoreTable,
  );

  // Test questions from documents state
  const [documents, setDocuments] = useState<AIDocument[]>([]);
  const [numQuestions, setNumQuestions] = useState(10);
  const [questionGuidance, setQuestionGuidance] = useState("");

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
  const [columnProgress, setColumnProgress] = useState<AIProgress | undefined>(
    undefined,
  );
  const columnCancelId = useRef<string | undefined>(undefined);
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
      undoReplace.remember();
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

      const cancelId = `ai-column-${uuidv4()}`;
      columnCancelId.current = cancelId;
      setColumnProgress({ done: 0, failed: 0, total: rows.length });
      const generated = await generateColumn(
        { cols: colValues.map((col) => col.header), rows },
        generateColumnPrompt,
        fastModel,
        apiKeys,
        { onProgress: setColumnProgress, cancelId },
      );
      // Rows that failed, or weren't reached before a stop, are left blank
      if (generated.canceled && generated.rows.every((r) => !r)) return;
      onAddColumns(
        [{ key: `col-${uuidv4()}`, header: generated.col }],
        generated.rows,
      );
      if (generated.failed > 0 && showAlert)
        showAlert(
          `Filled ${rows.length - generated.failed} of ${rows.length} rows; the other ${generated.failed} failed and were left blank.${generated.errors[0] ? ` The first error: ${generated.errors[0]}` : ""}`,
        );
    } catch (err) {
      handleError(err);
    } finally {
      setIsGenerateColumnLoading(false);
      setColumnProgress(undefined);
      columnCancelId.current = undefined;
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
      {columnProgress ? (
        <Stack spacing={4}>
          <Progress
            color="grape"
            size="sm"
            value={
              (100 * (columnProgress.done + columnProgress.failed)) /
              Math.max(columnProgress.total, 1)
            }
          />
          <Flex justify="space-between" align="center">
            <Text size="xs" c="dimmed">
              Filled {columnProgress.done} of {columnProgress.total} rows
              {columnProgress.failed > 0
                ? ` (${columnProgress.failed} failed)`
                : ""}
            </Text>
            <Button
              size="xs"
              variant="subtle"
              color="gray"
              onClick={() => {
                if (columnCancelId.current)
                  CancelTracker.add(columnCancelId.current);
              }}
            >
              Stop
            </Button>
          </Flex>
        </Stack>
      ) : (
        <Tooltip
          label="Queries the model once per row. Stopping keeps the rows already filled."
          withArrow
          position="bottom"
        >
          <Button
            size="sm"
            variant="light"
            color="grape"
            fullWidth
            onClick={handleGenerateColumn}
            disabled={
              !enoughRowsForSuggestions ||
              !generateColumnPrompt.trim() ||
              isGenerateColumnLoading
            }
            loading={isGenerateColumnLoading}
          >
            Add Column
          </Button>
        </Tooltip>
      )}
    </Stack>
  );

  const handleGenerateTestQuestions = async () => {
    setValuesLoading(true);
    try {
      const { rows, failed, errors } = await generateTestQuestions(
        documents,
        numQuestions,
        questionGuidance,
        fastModel,
        apiKeys,
      );
      const columns = TEST_QUESTION_COLUMNS.map((col, index) => ({
        key: `col-${index}`,
        header: col,
      }));
      undoReplace.remember();
      onReplaceTable(
        columns,
        rows.map((cells) => {
          const rowData: TabularDataRowType = { __uid: uuidv4() };
          columns.forEach((col, index) => {
            rowData[col.key] = cells[index] ?? "";
          });
          return rowData;
        }),
      );
      if (failed > 0 && showAlert)
        showAlert(
          `Wrote ${rows.length} questions, but no questions came back for ${failed} ${failed === 1 ? "passage" : "passages"}.${errors[0] ? ` The first error: ${errors[0]}` : ""}`,
        );
    } catch (err) {
      handleError(err);
    } finally {
      setValuesLoading(false);
    }
  };

  const documentsUI = (
    <Stack spacing="xs">
      <Text size="xs" c="dimmed" mt={5}>
        Writes questions and reference answers grounded in the documents
        connected to this table&apos;s input, e.g. from an Upload Docs or
        Chunking node, for evaluating a RAG pipeline. Replaces the table.
      </Text>
      {documents.length === 0 ? (
        <Text size="xs" c="grape">
          No documents found. Connect an Upload Docs or Chunking node to this
          table&apos;s input.
        </Text>
      ) : (
        <Text size="xs">
          {documents.length} document{documents.length === 1 ? "" : "s"} or
          chunk{documents.length === 1 ? "" : "s"} connected.
        </Text>
      )}
      <Textarea
        label="What kind of questions? (optional)"
        placeholder="e.g. questions a new employee might ask"
        size="sm"
        minRows={2}
        maxRows={3}
        autosize
        value={questionGuidance}
        onChange={(e) => setQuestionGuidance(e.currentTarget.value)}
      />
      <NumberInput
        label="Questions to write"
        size="xs"
        min={1}
        max={50}
        value={numQuestions}
        onChange={(num) => setNumQuestions(num || 1)}
      />
      <Button
        size="sm"
        variant="light"
        color="grape"
        fullWidth
        onClick={handleGenerateTestQuestions}
        disabled={documents.length === 0}
        loading={areValuesLoading}
      >
        Write Questions
      </Button>
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
    <AIPopover
      model={fastModel}
      onOpen={() => setDocuments(getDocuments ? getDocuments() : [])}
    >
      <Tabs color="grape" defaultValue="replace">
        <Tabs.List grow style={{ flexWrap: "nowrap" }}>
          <Tabs.Tab value="replace">Replace</Tabs.Tab>
          <Tabs.Tab value="extend">Extend</Tabs.Tab>
          {getDocuments && <Tabs.Tab value="documents">From docs</Tabs.Tab>}
        </Tabs.List>
        <Tabs.Panel value="extend" pb="xs">
          {extendUI}
        </Tabs.Panel>
        <Tabs.Panel value="replace" pb="xs">
          {replaceUI}
        </Tabs.Panel>
        <Tabs.Panel value="documents" pb="xs">
          {documentsUI}
        </Tabs.Panel>
      </Tabs>
      {undoReplace.canUndo && (
        <UndoAIOverwriteButton
          label="Undo replacing the table"
          onUndo={undoReplace.undo}
        />
      )}
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

  // Undo for Replace
  const restoreValues = useCallback(
    (before: Dict<string> | string[]) => onReplaceValues(Object.values(before)),
    [onReplaceValues],
  );
  const undoReplace = useUndoAIOverwrite(values, restoreValues);

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
      .then((vals) => {
        undoReplace.remember();
        onReplaceValues(vals);
      })
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
    undoReplace.remember,
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
      {undoReplace.canUndo && (
        <UndoAIOverwriteButton label="Undo replace" onUndo={undoReplace.undo} />
      )}
    </AIPopover>
  );
}

/**
 * Asks a model for code, returning the code blocks in its reply, joined and
 * retabbed to 2 spaces, or undefined if it wrote none.
 * @param onlyFirstFunc The name of a function to keep only the first definition of.
 */
async function generateCode(
  model: LLMSpec,
  prompt: string,
  apiKeys: Dict,
  onlyFirstFunc?: string,
): Promise<string | undefined> {
  const reply = await queryAI(model, prompt, { apiKeys });
  let codeBlocks: string[] = splitText(reply, "code", false);
  if (codeBlocks.length === 0) return undefined;
  if (onlyFirstFunc)
    codeBlocks = dropRepeatedDefinitions(codeBlocks, onlyFirstFunc);
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
  // The keys available in vars and metavar dicts, for added context to the LLM,
  // or a function to get them when the code is generated
  context: VarsContext | (() => VarsContext);
  // The code currently in the evaluator
  currentEvalCode: string;
  // Whether the code evaluates responses (the default) or transforms them
  nodeType?: "evaluator" | "processor";
  // Style overrides for the button, e.g. outside a node's header
  buttonStyle?: React.CSSProperties;
}

/**
 * AI Popover UI for code evaluators and processors.
 */
export function AIGenCodeEvaluatorPopover({
  progLang,
  onGeneratedCode,
  onLoadingChange,
  context,
  currentEvalCode,
  nodeType = "evaluator",
  buttonStyle,
}: AIGenCodeEvaluatorPopoverProps) {
  const isProcessor = nodeType === "processor";
  const { smartModel, apiKeys } = useAIFeatures();

  // State
  const [replacePrompt, setReplacePrompt] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const [awaitingResponse, setAwaitingResponse] = useState(false);

  // Alerts
  const showAlert = useContext(AlertModalContext);
  const [didEncounterError, setDidEncounterError] = useState(false);

  // Undo for Replace and Edit, which both overwrite the code
  const undoCodeChange = useUndoAIOverwrite(currentEvalCode, onGeneratedCode);

  // Queries the model for code, putting it in the editor
  const runCodeQuery = useCallback(
    (prompt: string, onlyFirstFunc?: string) => {
      setDidEncounterError(false);
      setAwaitingResponse(true);
      if (onLoadingChange) onLoadingChange(true);

      generateCode(smartModel, prompt, apiKeys, onlyFirstFunc)
        .then((code) => {
          if (code !== undefined) {
            undoCodeChange.remember();
            onGeneratedCode(code);
          }
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
    [
      smartModel,
      apiKeys,
      onLoadingChange,
      onGeneratedCode,
      showAlert,
      undoCodeChange.remember,
    ],
  );

  // Generate an evaluate function, given the user-specified prompt, in the proper programming language
  const handleGenerateEvalCode = useCallback(() => {
    const contextPrompt = buildContextPromptForVarsMetavars(
      typeof context === "function" ? context() : context,
    );
    const prompt = isProcessor
      ? buildGenProcessorCodePrompt(progLang, contextPrompt, replacePrompt)
      : buildGenEvalCodePrompt(
          progLang,
          contextPrompt,
          replacePrompt,
          false,
          false,
        );
    runCodeQuery(prompt, isProcessor ? "process" : "evaluate");
  }, [progLang, context, replacePrompt, runCodeQuery, isProcessor]);

  // Edit existing code according to user-specified instruction
  const handleEditCode = useCallback(() => {
    const prompt = `Edit the code below according to the following: ${editPrompt}

You ${progLang === "javascript" ? "CANNOT import any external packages." : "can use imports if necessary. Do not include any type hints."}
Functions should only return ${isProcessor ? "string or numeric values: the transformed text" : "boolean, numeric, or string values"}. Present the edited code in a single block.

Code:
\`\`\`${progLang}
${currentEvalCode}
\`\`\``;
    runCodeQuery(prompt);
  }, [progLang, editPrompt, currentEvalCode, runCodeQuery, isProcessor]);

  return (
    <AIPopover model={smartModel} buttonStyle={buttonStyle}>
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
              label={
                isProcessor
                  ? "Describe how to transform each response:"
                  : "Describe what to evaluate:"
              }
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
      {undoCodeChange.canUndo && (
        <UndoAIOverwriteButton
          label="Undo AI code change"
          onUndo={undoCodeChange.undo}
        />
      )}
    </AIPopover>
  );
}

export interface AIGenRubricPopoverProps {
  // The LLM Scorer's expected output format
  format: RubricFormat;
  // The rubric currently written, for the Edit tab
  currentRubric: string;
  // Called with the rubric the AI wrote, to put in the scorer
  onGeneratedRubric: (rubric: string) => void;
  // Style overrides for the button, e.g. outside a node's header
  buttonStyle?: React.CSSProperties;
}

/**
 * AI Popover UI for LLM Scorers: drafts or edits the grading rubric.
 */
export function AIGenRubricPopover({
  format,
  currentRubric,
  onGeneratedRubric,
  buttonStyle,
}: AIGenRubricPopoverProps) {
  const { smartModel, apiKeys } = useAIFeatures();
  const showAlert = useContext(AlertModalContext);

  const [replacePrompt, setReplacePrompt] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const [awaitingResponse, setAwaitingResponse] = useState(false);

  // Undo for Replace and Edit, which both overwrite the rubric
  const undoRubricChange = useUndoAIOverwrite(currentRubric, onGeneratedRubric);

  const runRubricQuery = useCallback(
    (request: string, rubricToEdit?: string) => {
      setAwaitingResponse(true);
      generateRubric(request, format, smartModel, apiKeys, rubricToEdit)
        .then((rubric) => {
          undoRubricChange.remember();
          onGeneratedRubric(rubric);
        })
        .catch((err) => {
          console.error(err);
          if (showAlert) showAlert(errorMessage(err));
        })
        .finally(() => setAwaitingResponse(false));
    },
    [
      format,
      smartModel,
      apiKeys,
      onGeneratedRubric,
      showAlert,
      undoRubricChange.remember,
    ],
  );

  return (
    <AIPopover model={smartModel} buttonStyle={buttonStyle}>
      <Tabs color="grape" defaultValue="replace">
        <Tabs.List grow>
          <Tabs.Tab value="replace">Replace</Tabs.Tab>
          <Tabs.Tab value="edit" disabled={!currentRubric.trim()}>
            Edit
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="replace" pb="xs">
          <Textarea
            label="Describe what to grade:"
            description="The drafted rubric replaces the current one, and fits the scorer's expected format."
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
            onClick={() => runRubricQuery(replacePrompt)}
            disabled={!replacePrompt.trim()}
            loading={awaitingResponse}
          >
            Draft Rubric
          </Button>
        </Tabs.Panel>
        <Tabs.Panel value="edit" pb="xs">
          <Textarea
            label="Describe how to change the rubric:"
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
            onClick={() => runRubricQuery(editPrompt, currentRubric)}
            disabled={!editPrompt.trim()}
            loading={awaitingResponse}
          >
            Edit Rubric
          </Button>
        </Tabs.Panel>
      </Tabs>
      {undoRubricChange.canUndo && (
        <UndoAIOverwriteButton
          label="Undo AI rubric change"
          onUndo={undoRubricChange.undo}
        />
      )}
    </AIPopover>
  );
}

export interface AIGenPromptVariantsPopoverProps {
  // The prompt the variants are based on (the variant currently shown)
  currentPrompt: string;
  // Called with the variants the AI wrote, to add to the Prompt Node
  onAddVariants: (variants: string[]) => void;
}

/**
 * AI Popover UI for Prompt Nodes: writes variants of the current prompt, which
 * are added alongside it for comparison, never replacing it.
 */
export function AIGenPromptVariantsPopover({
  currentPrompt,
  onAddVariants,
}: AIGenPromptVariantsPopoverProps) {
  const { smartModel, apiKeys } = useAIFeatures();
  const showAlert = useContext(AlertModalContext);

  const [numVariants, setNumVariants] = useState(2);
  const [guidance, setGuidance] = useState("");
  const [awaitingResponse, setAwaitingResponse] = useState(false);

  const handleGenerate = () => {
    setAwaitingResponse(true);
    generatePromptVariants(
      currentPrompt,
      numVariants,
      guidance,
      smartModel,
      apiKeys,
    )
      .then(onAddVariants)
      .catch((err) => {
        console.error(err);
        if (showAlert) showAlert(errorMessage(err));
      })
      .finally(() => setAwaitingResponse(false));
  };

  return (
    <AIPopover model={smartModel}>
      <Stack spacing="xs" mt="xs">
        <Text size="sm" fw={500}>
          Write prompt variants
        </Text>
        <Text size="xs" c="dimmed">
          Adds variants of the prompt shown, so you can compare them with it.
          Your prompt stays as it is.
        </Text>
        <Textarea
          label="How should they differ? (optional)"
          placeholder="e.g. more concise, or ask for step-by-step reasoning"
          size="sm"
          data-autofocus
          minRows={2}
          maxRows={4}
          autosize
          value={guidance}
          onChange={(e) => setGuidance(e.currentTarget.value)}
        />
        <NumberInput
          label="Variants to add"
          size="xs"
          min={1}
          max={5}
          value={numVariants}
          onChange={(num) => {
            if (typeof num === "number") setNumVariants(num);
          }}
        />
        <Button
          size="sm"
          variant="light"
          color="grape"
          fullWidth
          onClick={handleGenerate}
          disabled={!currentPrompt.trim()}
          loading={awaitingResponse}
        >
          Add Variants
        </Button>
      </Stack>
    </AIPopover>
  );
}
