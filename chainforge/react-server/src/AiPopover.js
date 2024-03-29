import React, { useCallback, useMemo, useRef, useState } from "react";
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
} from "@mantine/core";
import {
  autofill,
  generateAndReplace,
  AIError,
  getAIFeaturesModels,
} from "./backend/ai";
import { IconSparkles, IconAlertCircle } from "@tabler/icons-react";
import AlertModal from "./AlertModal";
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

const zeroGap = { gap: "0rem" };
const popoverShadow = "rgb(38, 57, 77) 0px 10px 30px -14px";

const ROW_CONSTANTS = {
  beginAutofilling: 1,
  warnIfBelow: 2,
};

const changeFourSpaceTabsToTwo = (code) => {
  const lines = code.split("\n");
  const retabbed_lines = [];
  function countLeadingSpaces(str) {
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
  progLang,
  context,
  specPrompt,
  manyFuncs,
  onlyBooleanFuncs,
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
export const buildContextPromptForVarsMetavars = (context) => {
  if (!context) return "";

  const promptify_key_arr = (arr) => {
    if (arr.length === 1) return `with the key "${arr[0]}"`;
    else return "with the keys " + arr.map((s) => `"${s}"`).join(", ");
  };

  let context_str = "";
  const metavars = context.metavars
    ? context.metavars.filter(cleanMetavarsFilterFunc)
    : [];
  const has_vars = context.vars && context.vars.length > 0;
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

/**
 * AI Popover UI for TextFields and Items nodes
 */
export function AIGenReplaceItemsPopover({
  // A list of strings for the Extend feature to use as a basis.
  values,
  // A function that takes a list of strings that the popover will call to add new values
  onAddValues,
  // A function that takes a list of strings that the popover will call to replace the existing values
  onReplaceValues,
  // A boolean that indicates whether the values are in a loading state
  areValuesLoading,
  // A function that takes a boolean that the popover will call to set whether the values should be loading
  setValuesLoading,
}) {
  // API keys
  const apiKeys = useStore((state) => state.apiKeys);

  const aiFeaturesProvider = useStore((state) => state.aiFeaturesProvider);

  // Alerts
  const alertModal = useRef(null);

  // Command Fill state
  const [commandFillNumber, setCommandFillNumber] = useState(3);
  const [isCommandFillLoading, setIsCommandFillLoading] = useState(false);
  const [didCommandFillError, setDidCommandFillError] = useState(false);

  // Generate and Replace state
  const [generateAndReplaceNumber, setGenerateAndReplaceNumber] = useState(3);
  const [generateAndReplacePrompt, setGenerateAndReplacePrompt] = useState("");
  const [
    generateAndReplaceIsUnconventional,
    setGenerateAndReplaceIsUnconventional,
  ] = useState(false);
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
          if (alertModal.current) alertModal.current.trigger(e?.message);
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
      generateAndReplaceIsUnconventional,
      aiFeaturesProvider,
      apiKeys,
    )
      .then(onReplaceValues)
      .catch((e) => {
        if (e instanceof AIError) {
          console.log(e);
          setDidGenerateAndReplaceError(true);
        } else {
          if (alertModal.current) alertModal.current.trigger(e?.message);
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
          onChange={setCommandFillNumber}
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
          onChange={setGenerateAndReplaceNumber}
        />
        <Switch
          color="grape"
          mb={10}
          size="xs"
          label="Make outputs unconventional"
          value={generateAndReplaceIsUnconventional}
          onChange={(e) =>
            setGenerateAndReplaceIsUnconventional(e.currentTarget.checked)
          }
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
      generateAndReplaceIsUnconventional,
      setGenerateAndReplaceIsUnconventional,
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
      <AlertModal ref={alertModal} />
    </AIPopover>
  );
}

/**
 * AI Popover UI for code evaluators.
 */
export function AIGenCodeEvaluatorPopover({
  // The programming language to generate evaluation code in (currently, only 'python' or 'javascript')
  progLang,
  // Callback when the AI has returned code to put in the evaluator's text editor
  onGeneratedCode,
  // Callback that takes a boolean that the popover will call to set whether the values are loading and are done loading
  onLoadingChange,
  // The keys available in vars and metavar dicts, for added context to the LLM
  context,
  // The code currently in the evaluator
  currentEvalCode,
}) {
  // API keys
  const apiKeys = useStore((state) => state.apiKeys);
  const aiFeaturesProvider = useStore((state) => state.aiFeaturesProvider);

  // State
  const [replacePrompt, setReplacePrompt] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const [awaitingResponse, setAwaitingResponse] = useState(false);

  // Alerts
  const alertModal = useRef(null);
  const [didEncounterError, setDidEncounterError] = useState(false);

  // Handle errors
  const handleError = useCallback(
    (err) => {
      setAwaitingResponse(false);
      if (onLoadingChange) onLoadingChange(false);
      setDidEncounterError(true);
      if (typeof err !== "string") console.error(err);
      alertModal.current?.trigger(typeof err === "string" ? err : err?.message);
    },
    [setAwaitingResponse, onLoadingChange, setDidEncounterError, alertModal],
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
        const response = result.responses[0].responses[0];
        console.log("LLM said: ", response);

        // Try to extract out a single code block from the response
        let code_blocks = splitText(response, "code");

        // Concat all found code blocks
        if (code_blocks.length > 0) {
          // Success! (we assume...)
          // If there's more than 1 code block, remove any others that also define an 'evaluate' function,
          // after the first appearance:
          const first_eval = code_blocks.findIndex((c) =>
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
        if (result.errors && Object.keys(result.errors).length > 0)
          throw new Error(Object.values(result.errors)[0].toString());

        // Extract the first response
        const response = result.responses[0].responses[0];
        console.log("LLM said: ", response);

        // Try to extract out a single code block from the response
        const code_blocks = splitText(response, "code");

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
      <AlertModal ref={alertModal} />
    </AIPopover>
  );
}
