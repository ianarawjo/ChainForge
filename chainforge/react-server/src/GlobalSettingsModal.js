import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { TextInput, Button, Group, Box, Modal, Divider, Text, Tabs, useMantineTheme, rem, Flex, Center } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useForm } from '@mantine/form';
import { IconUpload, IconBrandPython, IconX } from '@tabler/icons-react';
import { Dropzone, DropzoneProps } from '@mantine/dropzone';
import useStore from './store';
import { APP_IS_RUNNING_LOCALLY } from './backend/utils';
import fetch_from_backend from './fetch_from_backend';
import { addCustomProviders } from './ModelSettingSchemas';

const _LINK_STYLE = {color: '#1E90FF', textDecoration: 'none'};

// Read a file as text and pass the text to a cb (callback) function
const read_file = (file, cb) => {
  const reader = new FileReader();
  reader.onload = function(event) {
    const fileContent = event.target.result;
    cb(fileContent);
  };
  reader.onerror = function(event) {
    console.error("Error reading file:", event);
  };
  reader.readAsText(file);
};

/** A Dropzone to load a Python `.py` script that registers a `CustomModelProvider` in the Flask backend. 
 * If successful, the list of custom model providers in the ChainForge UI dropdown is updated. 
 * */ 
const CustomProviderScriptDropzone = ({id, alertModal}) => {
  const theme = useMantineTheme();
  return (<Dropzone
    onDrop={(files) => {
      if (files.length === 1) {
        const rejected = (msg) => {
          if (alertModal && alertModal.current)
            alertModal.current.trigger(msg);
        }
        read_file(files[0], (content) => {
          // Read the file into text and then send it to backend 
          fetch_from_backend('initCustomProvider', { 
            id: id, 
            code: content 
          }).then((response) => {
            if (response.error || !response.providers) {
              rejected(response.error);
              return;
            }
            // Successfully loaded custom providers in backend,
            // now load them into the ChainForge UI:
            console.log(response.providers);
            addCustomProviders(response.providers);
          }).catch((err) => rejected(err.message));
        });
      } else {
        console.error('Too many files dropped. Only drop one file at a time.')
      }
    }}
    onReject={(files) => console.log('rejected files', files)}
    maxSize={3 * 1024 ** 2}
    accept={{'text/x-python-script': []}}
  >
    <Flex pos="center" spacing="md" style={{ minHeight: rem(80), pointerEvents: 'none' }}>
    <Center>
      <Dropzone.Accept>
        <IconUpload
          size="4.2rem"
          stroke={1.5}
          color={theme.colors[theme.primaryColor][theme.colorScheme === 'dark' ? 4 : 6]}
        />
      </Dropzone.Accept>
      <Dropzone.Reject>
        <IconX size="4.2rem" 
               stroke={1.5}
               color={theme.colors.red[theme.colorScheme === 'dark' ? 4 : 6]} />
      </Dropzone.Reject>
      <Dropzone.Idle>
        <IconBrandPython size="4.2rem" stroke={1.5} />
      </Dropzone.Idle>

      <Box ml='md'>
        <Text size="md" lh={1.2} inline>
          Drag a Python script for your custom model provider here
        </Text>
        <Text size="sm" color="dimmed" inline mt={7}>
          Each script should contain one or more registered @provider callables
        </Text>
      </Box>
      </Center>
    </Flex>
    
  </Dropzone>);
};

const GlobalSettingsModal = forwardRef((props, ref) => {
  const [opened, { open, close }] = useDisclosure(false);
  const setAPIKeys = useStore((state) => state.setAPIKeys);
  const alertModal = props?.alertModal;

  const form = useForm({
    initialValues: {
      OpenAI: '',
      Anthropic: '',
      Google: '',
      Azure_OpenAI: '',
      Azure_OpenAI_Endpoint: '',
      HuggingFace: '',
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
          <Tabs defaultValue="api-keys">

            <Tabs.List>
              <Tabs.Tab value="api-keys" >API Keys</Tabs.Tab>
              <Tabs.Tab value="custom-providers" >Custom Model Providers</Tabs.Tab>
            </Tabs.List>


            <Tabs.Panel value="api-keys" pt="xs">
              <Text mb="md" fz="xs" lh={1.15} color='dimmed'>
                    Note: <b>We do not store your API keys</b> &mdash;not in a cookie, localStorage, or server. 
                    Because of this, <b>you must set your API keys every time you load ChainForge.</b> If you prefer not to worry about it, 
                    we recommend <a href="https://github.com/ianarawjo/ChainForge" target="_blank" style={_LINK_STYLE}>installing ChainForge locally</a> and
                    <a href="https://github.com/ianarawjo/ChainForge/blob/main/INSTALL_GUIDE.md#2-set-api-keys-openai-anthropic-google-palm" target="_blank" style={_LINK_STYLE}> setting your API keys as environment variables.</a>
              </Text>
              <form onSubmit={form.onSubmit(onSubmit)}>
                  <TextInput
                    label="OpenAI API Key"
                    placeholder="Paste your OpenAI API key here"
                    {...form.getInputProps('OpenAI')}
                  />

                  <br />
                  <TextInput
                    label="HuggingFace API Key"
                    placeholder="Paste your HuggingFace API key here"
                    {...form.getInputProps('HuggingFace')}
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
            </Tabs.Panel>

          {APP_IS_RUNNING_LOCALLY() ? 
            <Tabs.Panel value="custom-providers" pt="md">
              <Text mb="md" fz="sm" lh={1.3}>
                You can add model providers to ChainForge by writing custom completion functions as Python scripts. (You can even make your own settings screen!)
                To learn more, <a href="https://chainforge.ai/docs" target="_blank" style={_LINK_STYLE}>see the documentation.</a>
              </Text>
              <CustomProviderScriptDropzone id={'1'} alertModal={alertModal} />
            </Tabs.Panel>
          : <></>}
          </Tabs>
        </Box>
    </Modal>
  );
});

export default GlobalSettingsModal;