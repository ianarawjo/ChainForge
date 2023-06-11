import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { SimpleGrid, Card, Modal, Image, Group, Text, Button, Badge } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';

import { IconChartDots3 } from '@tabler/icons-react';

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
    (filename) => {close(); props.onSelect(filename);}
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
        {/* <ExampleFlowCard title="Test mathematical ability"
                         description="Evaluate the ability of different LLMs to perform basic math and get the correct answer. Showcases chaining prompt templates and using prompt variables in Evaluate nodes."
        />
        <ExampleFlowCard title="Does it conform to spec?"
                         description="Test how well a prompt and model conforms to a specification (instructed to format its output a certain way). Extracts and parses JSON outputs."
        /> */}
      </SimpleGrid>
    </Modal>
  );
});

export default ExampleFlowsModal;