import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { TextInput, Checkbox, Button, Group, Box, Modal, Divider, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useForm } from '@mantine/form';
import useStore from './store';

const GlobalSettingsModal = forwardRef((props, ref) => {
  const [opened, { open, close }] = useDisclosure(false);
  const setAPIKeys = useStore((state) => state.setAPIKeys);

  const form = useForm({
    initialValues: {
      OpenAI: '',
      Anthropic: '',
      Google: '',
      Azure_OpenAI: '',
      Azure_OpenAI_Endpoint: '',
    },

    validate: {
      // email: (value) => (/^\S+@\S+$/.test(value) ? null : 'Invalid email'),
    },
  });

  const onSubmit = (values) => {
    setAPIKeys(values);
    close();
  };

  // This gives the parent access to triggering the modal
  const trigger = () => {
    open();
  };
  useImperativeHandle(ref, () => ({
    trigger,
  }));

return (
    <Modal opened={opened} onClose={close} title="ChainForge Settings" closeOnClickOutside={false} style={{position: 'relative', 'left': '-100px'}}>
        <Box maw={380} mx="auto">
            <form onSubmit={form.onSubmit(onSubmit)}>
                <TextInput
                  label="OpenAI API Key"
                  description={<span>Note: We do not store your API keys in a cookie or file. 
                  Because of this, you must set your API keys every time you load ChainForge. 
                  If you don't want to worry about it, we recommend <a href="https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety" target="_blank" style={{color: '#1E90FF', textDecoration:'none'}}>setting the API key as an environment variable.</a></span>}
                  placeholder="Paste your OpenAI API key here"
                  {...form.getInputProps('OpenAI')}
                />

                <br />
                <TextInput
                  label="Anthropic API Key"
                  placeholder="Paste your Anthropic API key here"
                  {...form.getInputProps('Anthropic')}
                />

                <br />
                <TextInput
                  label="Google PaLM API Key"
                  placeholder="Paste your Google PaLM API key here"
                  {...form.getInputProps('Google')}
                />
                <br />

                <Divider my="xs" label="Microsoft Azure" labelPosition="center" />
                <TextInput
                  label="Azure OpenAI Key"
                  description={<span>For more details on Azure OpenAI, see <a href="https://learn.microsoft.com/en-us/azure/cognitive-services/openai/how-to/create-resource?pivots=web-portal" target="_blank" style={{color: '#1E90FF', textDecoration:'none'}}>Microsoft Learn.</a> Note that you will have to set the Deployment Name in the Settings of any Azure OpenAI model you add to a Prompt Node.</span>}
                    
                  placeholder="Paste your Azure OpenAI Key here"
                  {...form.getInputProps('Azure_OpenAI')}
                  style={{marginBottom: '8pt'}}
                />

                <TextInput
                  label="Azure OpenAI Endpoint"
                  placeholder="Paste your Azure OpenAI Endpoint here"
                  {...form.getInputProps('Azure_OpenAI_Endpoint')}
                />

                <Group position="right" mt="md">
                  <Button type="submit">Submit</Button>
                </Group>
            </form>
        </Box>
    </Modal>
  );
});

export default GlobalSettingsModal;