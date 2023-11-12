import React, { useCallback, useMemo } from 'react';
import { Stack, NumberInput, Button, Text, TextInput, Switch, Tabs, Popover, Badge, Textarea } from "@mantine/core"
import { useState } from 'react';
import { autofill, generateAndReplace, AIError } from './backend/ai';
import { IconSparkles } from '@tabler/icons-react';

const zeroGap = {gap: "0rem"};
const popoverShadow ="rgb(38, 57, 77) 0px 10px 30px -14px";

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
  setValuesLoading
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

  // At least 2 non-empty rows are needed for suggestions.
  const enoughRowsForSuggestions = useMemo(() => {
    const rows = Object.values(values);
    return rows.filter((row) => row !== '').length >= 2;
  }, [values]);

  const handleCommandFill = () => {
    setIsCommandFillLoading(true);
    setDidCommandFillError(false);
    autofill(
      Object.values(values),
      commandFillNumber
    )
    .then(onAddValues)
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
    .then(onReplaceValues)
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
    <Stack>
      {didCommandFillError ?
        <Text size="xs" c="red">
          Failed to generate. Please try again.
        </Text>
        : <></>}
      <NumberInput label="Items to add" mt={5} min={1} max={10} defaultValue={3} value={commandFillNumber} onChange={setCommandFillNumber}/>
      {enoughRowsForSuggestions ? <></>
      : <Text size="xs" c="grape" maw={200}>
          You must enter at least 2 fields before extending.
        </Text>}
      <Button size="sm" variant="light" color="grape" fullWidth onClick={handleCommandFill} disabled={!enoughRowsForSuggestions} loading={isCommandFillLoading}>Extend</Button>
    </Stack>
  );

  const replaceUI = (
    <Stack style={zeroGap}>
      {didGenerateAndReplaceError ?
        <Text size="xs" c="red">
          Failed to generate. Please try again.
        </Text>
        : <></>}
      <Textarea label="Generate a list of..." minRows={1} maxRows={4} autosize mt={5} value={generateAndReplacePrompt} onChange={(e) => setGenerateAndReplacePrompt(e.currentTarget.value)}/>
      <NumberInput label="Items to generate" size="xs" mb={10} min={1} max={10} defaultValue={3} value={generateAndReplaceNumber} onChange={setGenerateAndReplaceNumber}/>
      <Switch color="grape" mb={10} size="xs" label="Make outputs unconventional" value={generateAndReplaceIsUnconventional} onChange={(e) => setGenerateAndReplaceIsUnconventional(e.currentTarget.checked)}/>
      <Button size="sm" variant="light" color="grape" fullWidth onClick={handleGenerateAndReplace} loading={areValuesLoading}>Replace</Button>
    </Stack>
  );
  
  return (
    <Popover position="right-start" withArrow shadow={popoverShadow} withinPortal keepMounted>
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
              <Tabs.Tab value="replace">
                  Replace
                </Tabs.Tab>
              <Tabs.Tab value="extend">
                Extend
              </Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="extend" pb="xs">
              {extendUI}
            </Tabs.Panel>
            <Tabs.Panel value="replace" pb="xs">
              {replaceUI}
            </Tabs.Panel>
          </Tabs>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

export default AIPopover;
