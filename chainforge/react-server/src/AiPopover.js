import React, { useMemo, useRef } from 'react';
import { Stack, NumberInput, Button, Text, TextInput, Switch, Tabs, Popover, Badge, Textarea, Alert } from "@mantine/core"
import { useState } from 'react';
import { autofill, generateAndReplace, AIError } from './backend/ai';
import { IconSparkles, IconAlertCircle } from '@tabler/icons-react';
import AlertModal from './AlertModal';
import { useStore } from './store';

const zeroGap = {gap: "0rem"};
const popoverShadow ="rgb(38, 57, 77) 0px 10px 30px -14px";

const ROW_CONSTANTS = {
  "beginAutofilling": 1,
  "warnIfBelow": 2,
}


function AIPopover({
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
  // API keys to pass when querying LLMs (only those from front-end settings window)
  apiKeys,
}) {

  // Command Fill state
  const [commandFillNumber, setCommandFillNumber] = useState(3);
  const [isCommandFillLoading, setIsCommandFillLoading] = useState(false);
  const [didCommandFillError, setDidCommandFillError] = useState(false);

  // Generate and Replace state
  const [generateAndReplaceNumber, setGenerateAndReplaceNumber] = useState(3);
  const [generateAndReplacePrompt, setGenerateAndReplacePrompt] = useState('');
  const [generateAndReplaceIsUnconventional, setGenerateAndReplaceIsUnconventional] = useState(false);
  const [didGenerateAndReplaceError, setDidGenerateAndReplaceError] = useState(false);

  // To check for OpenAI API key
  const noOpenAIKeyMessage = useMemo(() => {
    if (apiKeys && apiKeys['OpenAI']) return undefined;
    else return (
      <Alert variant="light" color="grape" title="No OpenAI API key detected." maw={200} fz='xs' icon={<IconAlertCircle />}>
        You must set an OpenAI API key before you can use generative AI support features.
      </Alert>
    );
  }, [apiKeys]);

  // Alert for errors
  const alertModal = useRef(null);

  const nonEmptyRows = useMemo(() =>
    Object.values(values).filter((row) => row !== '').length,
    [values]);

  const enoughRowsForSuggestions = useMemo(() =>
    nonEmptyRows >= ROW_CONSTANTS.beginAutofilling,
    [nonEmptyRows]);

  const showWarning = useMemo(() =>
    enoughRowsForSuggestions && nonEmptyRows < ROW_CONSTANTS.warnIfBelow,
    [enoughRowsForSuggestions, nonEmptyRows]);

  const handleCommandFill = () => {
    setIsCommandFillLoading(true);
    setDidCommandFillError(false);
    autofill(
      Object.values(values),
      commandFillNumber,
      apiKeys,
    )
    .then(onAddValues)
    .catch(e => {
      if (e instanceof AIError) {
        setDidCommandFillError(true);
      } else {
        if (alertModal.current) alertModal.current.trigger(e?.message);
        else console.error(e);
      }
    }).finally(() => setIsCommandFillLoading(false));
  };

  const handleGenerateAndReplace = () => {
    setDidGenerateAndReplaceError(false);
    setValuesLoading(true);
    generateAndReplace(
      generateAndReplacePrompt,
      generateAndReplaceNumber,
      generateAndReplaceIsUnconventional,
      apiKeys,
    )
    .then(onReplaceValues)
    .catch(e => {
      if (e instanceof AIError) {
        console.log(e);
        setDidGenerateAndReplaceError(true);
      } else {
        if (alertModal.current) alertModal.current.trigger(e?.message);
        else console.error(e);
      }
    }).finally(() => setValuesLoading(false));
  };

  const extendUI = useMemo(() => (
    <Stack>
      {didCommandFillError ?
        <Text size="xs" c="red">
          Failed to generate. Please try again.
        </Text>
        : <></>}
      <NumberInput label="Items to add" mt={5} min={1} max={10} defaultValue={3} value={commandFillNumber} onChange={setCommandFillNumber}/>
      {enoughRowsForSuggestions ? <></>
      : <Text size="xs" c="grape" maw={200}>
          You must enter at least {ROW_CONSTANTS.beginAutofilling} fields before extending.
        </Text>}
      {showWarning ?
        <Text size="xs" c="grape" maw={200}>
          You have less than {ROW_CONSTANTS.warnIfBelow} fields. You may want to add more. Adding more rows typically improves the quality of the suggestions.
        </Text>
        : <></>}
      <Button size="sm" variant="light" color="grape" fullWidth onClick={handleCommandFill} disabled={!enoughRowsForSuggestions} loading={isCommandFillLoading}>Extend</Button>
    </Stack>
  ), [didCommandFillError, enoughRowsForSuggestions, showWarning, isCommandFillLoading, handleCommandFill, setCommandFillNumber, commandFillNumber] );

  const replaceUI = useMemo(() => (
    <Stack style={zeroGap}>
      {didGenerateAndReplaceError ?
        <Text size="xs" c="red">
          Failed to generate. Please try again.
        </Text>
        : <></>}
      <Textarea label="Generate a list of..." data-autofocus minRows={1} maxRows={4} autosize mt={5} value={generateAndReplacePrompt} onChange={(e) => setGenerateAndReplacePrompt(e.currentTarget.value)}/>
      <NumberInput label="Items to generate" size="xs" mb={10} min={1} max={10} defaultValue={3} value={generateAndReplaceNumber} onChange={setGenerateAndReplaceNumber} />
      <Switch color="grape" mb={10} size="xs" label="Make outputs unconventional" value={generateAndReplaceIsUnconventional} onChange={(e) => setGenerateAndReplaceIsUnconventional(e.currentTarget.checked)}/>
      <Button size="sm" variant="light" color="grape" fullWidth onClick={handleGenerateAndReplace} loading={areValuesLoading}>Replace</Button>
    </Stack>
  ), [didGenerateAndReplaceError, generateAndReplacePrompt, setGenerateAndReplacePrompt, generateAndReplaceNumber, setGenerateAndReplaceNumber, generateAndReplaceIsUnconventional, setGenerateAndReplaceIsUnconventional, handleGenerateAndReplace, areValuesLoading]);
  
  return (
    <Popover position="right-start" withArrow shadow={popoverShadow} withinPortal keepMounted trapFocus>
      <Popover.Target>
        <button className="ai-button nodrag"><IconSparkles size={10} stroke={3}/></button>
      </Popover.Target>
      <Popover.Dropdown className="nodrag nowheel">
        <Stack style={zeroGap}>
          <Badge color="grape" variant="light" leftSection={<IconSparkles size={10} stroke={3}/>}>
            Generative AI
          </Badge>
          <Tabs color="grape" defaultValue="replace">
            <Tabs.List grow>
              <Tabs.Tab value="replace">Replace</Tabs.Tab>
              <Tabs.Tab value="extend">Extend</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="extend" pb="xs">
              {noOpenAIKeyMessage ? noOpenAIKeyMessage : extendUI}
            </Tabs.Panel>
            <Tabs.Panel value="replace" pb="xs">
              {noOpenAIKeyMessage ? noOpenAIKeyMessage : replaceUI}
            </Tabs.Panel>
          </Tabs>
        </Stack>
      </Popover.Dropdown>

      <AlertModal ref={alertModal} />
    </Popover>
  );
}

export default AIPopover;
