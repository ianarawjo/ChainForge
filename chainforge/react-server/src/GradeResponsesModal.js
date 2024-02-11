import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { SimpleGrid, Card, Modal, Text, Button, Checkbox, UnstyledButton, Textarea, TextInput, Flex, Progress } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconChartDots3, IconSparkles, IconThumbDown, IconThumbUp } from '@tabler/icons-react';
import useStore from './store';

/** Example flows to help users get started and see what CF can do */
const CriteriaCard = ({ title, description, buttonText }) => {
  const [checked, setChecked] = useState(true);
  const [desc, setDesc] = useState(description);

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder style={{backgroundColor: checked ? '#f2f7fc' : '#fff'}}>
      <UnstyledButton onClick={() => setChecked(!checked)} onKeyUp={(e) => e.preventDefault()} className="checkcard">
        <Checkbox
          checked={checked}
          onChange={() => setChecked(!checked)}
          tabIndex={-1}
          size="md"
          mr="xl"
          styles={{ input: { cursor: 'pointer' } }}
          aria-hidden
        />

        <div>
          <Text fw={500} mb={7} lh={1} fz='md'>
            {title}
          </Text>
          <Textarea value={desc}
                    onChange={(e) => setDesc(e.currentTarget.value)} 
                    onClickCapture={(e) => e.stopPropagation()} 
                    styles={{input: {border: 'none', borderWidth: '0px', padding: '0px', color: '#444', background: 'transparent'}}} 
                    autosize fz="sm" c="dimmed" />
        </div>
      </UnstyledButton>
    </Card>
  );
};

// Pop-up to ask user to pick criterias for evaluation
export const PickCriteriaModal = forwardRef((props, ref) => {
  const [opened, { open, close }] = useDisclosure(false);

  // This gives the parent access to triggering the modal alert
  const trigger = () => {
    open();
  };
  useImperativeHandle(ref, () => ({
    trigger,
  }));

  return (
    <Modal size='900px' opened={opened} onClose={close} title={<div><span style={{fontSize: '14pt'}}>Pick Criteria</span></div>} closeOnClickOutside={true} style={{position: 'relative', 'left': '-5%'}}>      
      <Text size='sm' pl='sm' mb='lg'>
        Select criteria that you would like to evaluate responses on. Based on your chosen criteria, LLM will generate implementations of assertions. 
        Afterwards, an optional human scoring pass can better align these implementations with your expectations. 
      </Text>
      <SimpleGrid cols={3} spacing='sm' verticalSpacing='sm' mb='lg'>
        <CriteriaCard title="Grammaticality"
                      description="The text is grammatically correct." 
        />
        <CriteriaCard title="Length"
                        description="The text is 144 characters or less." 
        />
        <CriteriaCard title="Clickbait potential"
                        description="How likely the text is to drive attention as a Tweet." 
        />
        <CriteriaCard title="Informality"
                        description="Whether the response sounds informal, like a real human tweeted it."
        />
        <CriteriaCard title="Toxicity"
                        description="Whether the response sounds overly harmful or toxic."
        />
      </SimpleGrid> 

      <TextInput  label="Suggest a criteria to add:"
                  placeholder="the response is valid JSON"
                  mb='lg' />
      <Flex justify="center">
        <Button variant='gradient'><IconSparkles />&nbsp;Generate!</Button>
      </Flex> 
    </Modal>
  );
});

// Pop-up where user grades responses.
export const GradeResponsesModal = forwardRef((props, ref) => {
  // Mantine modal popover for alerts
  const [opened, { open, close }] = useDisclosure(false);

  // Global lookup for what color to use per LLM
  const getColorForLLMAndSetIfNotFound = useStore((state) => state.getColorForLLMAndSetIfNotFound);

  // This gives the parent access to triggering the modal alert
  const trigger = () => {
    open();
  };
  useImperativeHandle(ref, () => ({
    trigger,
  }));

  return (
    <Modal size='900px' opened={opened} onClose={close} title={<div><span style={{fontSize: '14pt'}}>Grade Responses</span></div>} closeOnClickOutside={true} style={{position: 'relative', 'left': '-5%'}}>      
      <Flex justify='center'>
        <Text size='xl' fw={500} pl='sm' mb='lg'>
          Is this response&nbsp;<IconThumbUp style={{marginBottom: '-3px'}} />&nbsp;or&nbsp;<IconThumbDown style={{marginBottom: '-6px'}} />&nbsp;?
        </Text>
      </Flex> 

      <Flex justify='center' mb='xl'>
        <div className="response-box" style={{ backgroundColor: "#ddd", width: "80%" }}>
          <div className="response-var-inline-container">
            <div className="response-var-inline" >
              <span className="response-var-name">var&nbsp;=&nbsp;</span><span className="response-var-value">value</span>
            </div>
          </div>
          <div className="response-item-llm-name-wrapper">
            <h1>GPT-4</h1>
            <div className="small-response" style={{fontSize:"11pt", padding: '12pt'}}>Holy cow! Check out what happened today in the world of Taylor Swift!</div>
          </div>
        </div>
      </Flex>

      <Flex justify="center" gap='50px' mb='xl'>
        <Button color='red' variant='filled'><IconThumbDown />&nbsp;Bad!</Button>
        <Button color='green' variant='filled'><IconThumbUp />&nbsp;Good!</Button>
      </Flex> 

      <Flex justify='left' align='center' gap='md'>
        <Progress size={18} w='100%' sections={[{ value: 30, color: 'blue', label: '3/10 graded', tooltip: 'Samples graded' }]} />
        <Button variant='outline'>I'm tired</Button>
      </Flex>
      
    </Modal>
  );
});