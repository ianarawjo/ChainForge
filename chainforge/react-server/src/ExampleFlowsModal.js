import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { SimpleGrid, Card, Modal, Image, Group, Text, Button, Badge, Tabs, Alert, Code } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconChartDots3, IconAlertCircle } from '@tabler/icons-react';
import { BASE_URL } from './store';

/** Example flows to help users get started and see what CF can do */
const ExampleFlowCard = ({ title, description, buttonText, filename, onSelect }) => {
  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder >
      {/* <Card.Section>
        <Image
          src="..."
          height={160}
          alt="Alt text"
        />
      </Card.Section> */}

      <Text mb="xs" weight={500}>{title}</Text>

      <Text size="sm" color="dimmed" lh={1.3}>
        {description}
      </Text>

      <Button onClick={() => onSelect(filename)} variant="light" color="blue" fullWidth mt="md" radius="md">
        {buttonText ? buttonText : 'Try me'}
      </Button>
      
    </Card>
  );
};

const ExampleFlowsModal = forwardRef((props, ref) => {
  // Mantine modal popover for alerts
  const [opened, { open, close }] = useDisclosure(false);

  // Callback for when an example flow is selected. Passed the name of the selected flow.
  const onSelect = props.onSelect ? (
    (filename, category) => {close(); props.onSelect(filename, category);}
  ) : undefined;

  // This gives the parent access to triggering the modal alert
  const trigger = () => {
    open();
  };
  useImperativeHandle(ref, () => ({
    trigger,
  }));

  return (
    <Modal size='xl' opened={opened} onClose={close} title={<div><IconChartDots3 size={24} style={{position:'relative', marginRight: '8px', top: '4px'}} /><span style={{fontSize: '14pt'}}>Example Flows</span></div>} closeOnClickOutside={true} style={{position: 'relative', 'left': '-100px'}}>      
      <Tabs defaultValue="examples">
        <Tabs.List>
          <Tabs.Tab value="examples" >Basic Examples</Tabs.Tab>
          <Tabs.Tab value="openai-evals" >OpenAI Evals</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="examples" pt="xs">
          <SimpleGrid cols={3} spacing='sm' verticalSpacing='sm'>
            <ExampleFlowCard title="Compare length of responses across LLMs"
                            description="A simple evaluation with a prompt template, some inputs, and three models to prompt. Visualizes variability in response length." 
                            filename="basic-comparison"
                            onSelect={onSelect}
            />
            <ExampleFlowCard title="Robustness to prompt injection attacks"
                            description="Get a sense of different model's robustness against prompt injection attacks." 
                            filename="prompt-injection-test"
                            onSelect={onSelect}
            />
            <ExampleFlowCard title="Use an LLM as an evaluator"
                            description="Chain one prompt into another to extract entities from a text response. Plots number of entities." 
                            filename="chaining-prompts"
                            onSelect={onSelect}
            />
            <ExampleFlowCard title="Measure impact of system message on response"
                            description="Compares response quality across different ChatGPT system prompts. Visualizes how well it sticks to the instructions to only print Racket code."
                            filename="comparing-system-msg"
                            onSelect={onSelect}
            />
            <ExampleFlowCard title="Ground truth evaluation for math problems"
                            description="Uses a tabular data node to evaluate LLM performance on basic math problems. Compares responses to expected answer and plots performance across LLMs."
                            filename="basic-math"
                            onSelect={onSelect}
            />
            <ExampleFlowCard title="Detect whether OpenAI function call was triggered"
                            description="Basic example showing whether a given prompt triggered an OpenAI function call. Also shows difference between ChatGPT prior to function calls, and function call version."
                            filename="basic-function-calls"
                            onSelect={onSelect}
            />
            {/* <ExampleFlowCard title="Test mathematical ability"
                            description="Evaluate the ability of different LLMs to perform basic math and get the correct answer. Showcases chaining prompt templates and using prompt variables in Evaluate nodes."
            />
            <ExampleFlowCard title="Does it conform to spec?"
                            description="Test how well a prompt and model conforms to a specification (instructed to format its output a certain way). Extracts and parses JSON outputs."
            /> */}
          </SimpleGrid> 
        </Tabs.Panel>

        <Tabs.Panel value="openai-evals" pt="xs">
          <Text size='sm'>
            These flows are generated from the <a href='https://github.com/openai/evals' target='_blank'>OpenAI evals</a> benchmarking CI package. 
            We currently load evals with a common system message, a single 'turn' (prompt), and evaluation types of 'includes', 'match', and 'fuzzy match'.
          </Text>
          <ExampleFlowCard title="Evaluate something cool"
                            description="A description of the OpenAI eval goes here."
                            filename="oaieval-test"
                            onSelect={(name) => onSelect(name, 'openai-eval')}
          /> 
          {/* <Alert icon={<IconAlertCircle size="2rem" />} title="Bummer!" color="orange" mt="md" pl="sm" styles={{message: {fontSize: '12pt'}, title: {fontSize: '12pt'}}}>
            We detected that you do not have the <Code>evals</Code> package installed. To load ChainForge flows from OpenAI evals, install <Code>evals</Code> in the Python environment where you are running ChainForge:
            <Code style={{fontSize: '12pt'}} block mt="sm">pip install evals</Code>
          </Alert> */}
        </Tabs.Panel>
      </Tabs>
      
    </Modal>
  );
});

export default ExampleFlowsModal;