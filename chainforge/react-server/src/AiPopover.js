import React from 'react';
import { Stack, NumberInput, Button, Text, TextInput, Switch, Tabs } from "@mantine/core"
import { useState } from 'react';
import { autofill, generateAndReplace, AIError } from './backend/ai';

function AiPopover({
  // A list of strings for the Extend feature to use as a basis.
  values,
  // A function that takes a list of strings that the popover will call to add new values
  addValues,
  // A function that takes a list of strings that the popover will call to replace the existing values
  replaceValues,
  // A boolean that indicates whether the values are in a loading state
  areValuesLoading,
  // A function that takes a boolean that the popover will call to set whether the values should be loading
  setValuesLoading
}) {

  const [commandFillNumber, setCommandFillNumber] = useState(3);

  const [generateAndReplaceNumber, setGenerateAndReplaceNumber] = useState(3);
  const [generateAndReplacePrompt, setGenerateAndReplacePrompt] = useState('');
  const [generateAndReplaceIsUnconventional, setGenerateAndReplaceIsUnconventional] = useState(false);
  const [didGenerateAndReplaceError, setDidGenerateAndReplaceError] = useState(false);

  const [isCommandFillLoading, setIsCommandFillLoading] = useState(false);
  const [didCommandFillError, setDidCommandFillError] = useState(false);

  // At least 2 non-empty rows are needed for suggestions.
  function enoughRowsForSuggestions() {
    const rows = Object.values(values);
    return rows.filter((row) => row !== '').length >= 2;
  }

  const handleCommandFill = () => {
    setIsCommandFillLoading(true);
    setDidCommandFillError(false);
    autofill(
      Object.values(values),
      commandFillNumber
    )
    .then(addValues)
    .catch(e => {
      if (e instanceof AIError) {
        setDidCommandFillError(true);
      } else {
        throw new Error("Unexpected error: " + e);
      }
    }).finally(() => setIsCommandFillLoading(false));
  };

  const handleGenerateAndReplace = () => {
    setDidGenerateAndReplaceError(false);
    setValuesLoading(true);
    generateAndReplace(
      generateAndReplacePrompt,
      generateAndReplaceNumber,
      generateAndReplaceIsUnconventional
    )
    .then(replaceValues)
    .catch(e => {
      if (e instanceof AIError) {
        console.log(e);
        setDidGenerateAndReplaceError(true);
      } else {
        throw new Error("Unexpected error: " + e);
      }
    }).finally(() => setValuesLoading(false));
  };

  const extendUI = (
    <Stack gap={1}>
      {didCommandFillError ?
        <Text size="xs" c="red">
          Failed to generate. Please try again.
        </Text>
        : <></>}
      <NumberInput label="Rows" min={1} max={10} defaultValue={3} value={commandFillNumber} onChange={setCommandFillNumber}/>
      <Button size="sm" variant="light" color="grape" fullWidth onClick={handleCommandFill} disabled={!enoughRowsForSuggestions()} loading={isCommandFillLoading}>Extend</Button>
      {enoughRowsForSuggestions() ? <></>
      : <Text size="xs" c="grape">
          Enter at least 2 rows to generate suggestions.
        </Text>}
    </Stack>
  )

  const replaceUI = (
    <Stack gap={1}>
      {didGenerateAndReplaceError ?
        <Text size="xs" c="red">
          Failed to generate. Please try again.
        </Text>
        : <></>}
      <TextInput label="Generate a list of..." value={generateAndReplacePrompt} onChange={(e) => setGenerateAndReplacePrompt(e.currentTarget.value)}/>
      <NumberInput label="Rows" min={1} max={10} defaultValue={3} value={generateAndReplaceNumber} onChange={setGenerateAndReplaceNumber}/>
      <Switch color="grape" label="Make outputs unconventional" value={generateAndReplaceIsUnconventional} onChange={(e) => setGenerateAndReplaceIsUnconventional(e.currentTarget.checked)}/>
      <Button size="sm" variant="light" color="grape" fullWidth onClick={handleGenerateAndReplace} loading={areValuesLoading}>Replace</Button>
    </Stack>
  )

  const aiPopover = (
    <Tabs color="grape" defaultValue="extend">
      <Tabs.List grow>
        <Tabs.Tab value="extend">
          Extend
        </Tabs.Tab>
        <Tabs.Tab value="replace">
          Replace
        </Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="extend" pb="xs">
        {extendUI}
      </Tabs.Panel>
      <Tabs.Panel value="replace" pb="xs">
        {replaceUI}
      </Tabs.Panel>
    </Tabs>
  )

  return aiPopover;
}

export default AiPopover;
