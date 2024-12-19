import React, {
  useState,
  forwardRef,
  useImperativeHandle,
  useCallback,
  useEffect,
  useContext,
} from "react";
import {
  TextInput,
  Button,
  Group,
  Box,
  Modal,
  Divider,
  Text,
  Tabs,
  useMantineTheme,
  rem,
  Flex,
  Center,
  Badge,
  Card,
  Switch,
  Select,
  Checkbox,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useForm } from "@mantine/form";
import {
  IconUpload,
  IconBrandPython,
  IconX,
  IconSparkles,
} from "@tabler/icons-react";
import { Dropzone, FileWithPath } from "@mantine/dropzone";
import useStore from "./store";
import { APP_IS_RUNNING_LOCALLY } from "./backend/utils";
import { setCustomProviders } from "./ModelSettingSchemas";
import { getAIFeaturesModelProviders } from "./backend/ai";
import { CustomLLMProviderSpec, Dict } from "./backend/typing";
import {
  initCustomProvider,
  loadCachedCustomProviders,
  removeCustomProvider,
} from "./backend/backend";
import { AlertModalContext } from "./AlertModal";
import StorageCache from "./backend/cache";

const _LINK_STYLE = { color: "#1E90FF", textDecoration: "none" };

// To only let us call the backend to load custom providers once upon initalization
let LOADED_CUSTOM_PROVIDERS = false;

// Read a file as text and pass the text to a cb (callback) function
const read_file = (
  file: FileWithPath,
  cb: (contents: string | ArrayBuffer | null) => void,
) => {
  const reader = new window.FileReader();
  reader.onload = function (event) {
    const fileContent = event.target?.result;
    cb(fileContent ?? null);
  };
  reader.onerror = function (event) {
    console.error("Error reading file:", event);
  };
  reader.readAsText(file);
};

interface CustomProviderScriptDropzoneProps {
  onError: (err: string | Error) => void;
  onSetProviders: (providers: CustomLLMProviderSpec[]) => void;
}

/** A Dropzone to load a Python `.py` script that registers a `CustomModelProvider` in the Flask backend.
 * If successful, the list of custom model providers in the ChainForge UI dropdown is updated.
 * */
const CustomProviderScriptDropzone: React.FC<
  CustomProviderScriptDropzoneProps
> = ({ onError, onSetProviders }) => {
  const theme = useMantineTheme();
  const [isLoading, setIsLoading] = useState(false);

  return (
    <Dropzone
      loading={isLoading}
      onDrop={(files) => {
        if (files.length === 1) {
          setIsLoading(true);
          read_file(files[0], (content: string | ArrayBuffer | null) => {
            if (typeof content !== "string") {
              console.error("File unreadable: Contents are not text.");
              return;
            }
            // Read the file into text and then send it to backend
            initCustomProvider(content)
              .then((providers) => {
                setIsLoading(false);
                // Successfully loaded custom providers in backend,
                // now load them into the ChainForge UI:
                console.log(providers);
                setCustomProviders(providers);
                onSetProviders(providers);
              })
              .catch((err) => {
                setIsLoading(false);
                onError(err.message);
              });
          });
        } else {
          console.error(
            "Too many files dropped. Only drop one file at a time.",
          );
        }
      }}
      onReject={(files) => console.log("rejected files", files)}
      maxSize={3 * 1024 ** 2}
    >
      <Flex style={{ minHeight: rem(80), pointerEvents: "none" }}>
        <Center>
          <Dropzone.Accept>
            <IconUpload
              size="4.2rem"
              stroke={1.5}
              color={
                theme.colors[theme.primaryColor][
                  theme.colorScheme === "dark" ? 4 : 6
                ]
              }
            />
          </Dropzone.Accept>
          <Dropzone.Reject>
            <IconX
              size="4.2rem"
              stroke={1.5}
              color={theme.colors.red[theme.colorScheme === "dark" ? 4 : 6]}
            />
          </Dropzone.Reject>
          <Dropzone.Idle>
            <IconBrandPython size="4.2rem" stroke={1.5} />
          </Dropzone.Idle>

          <Box ml="md">
            <Text size="md" lh={1.2} inline>
              Drag a Python script for your custom model provider here
            </Text>
            <Text size="sm" color="dimmed" inline mt={7}>
              Each script should contain one or more registered @provider
              callables
            </Text>
          </Box>
        </Center>
      </Flex>
    </Dropzone>
  );
};

export interface GlobalSettingsModalRef {
  trigger: () => void;
}

const GlobalSettingsModal = forwardRef<GlobalSettingsModalRef, object>(
  function GlobalSettingsModal(props, ref) {
    const [opened, { open, close }] = useDisclosure(false);
    const setAPIKeys = useStore((state) => state.setAPIKeys);
    const getFlag = useStore((state) => state.getFlag);
    const setFlag = useStore((state) => state.setFlag);
    const AvailableLLMs = useStore((state) => state.AvailableLLMs);
    const aiFeaturesProvider = useStore((state) => state.aiFeaturesProvider);
    const setAIFeaturesProvider = useStore(
      (state) => state.setAIFeaturesProvider,
    );
    const setAvailableLLMs = useStore((state) => state.setAvailableLLMs);
    const nodes = useStore((state) => state.nodes);
    const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);

    const showAlert = useContext(AlertModalContext);

    const [aiSupportActive, setAISupportActive] = useState<boolean>(
      getFlag("aiSupport") as boolean,
    );
    const [aiAutocompleteActive, setAIAutocompleteActive] = useState<boolean>(
      getFlag("aiAutocomplete") as boolean,
    );

    // Image compression ratio setting. Store this flag in localStorage directly.
    const [imageCompression, _setImageCompression] = useState<boolean>(true);
    const setImageCompression = (value: boolean) => {
      StorageCache.saveToLocalStorage("imageCompression", { value });
      StorageCache.store("imageCompression", value);
      _setImageCompression(value);
    };

    const handleAISupportChecked = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const checked = e.currentTarget.checked;
        setAISupportActive(checked);
        setFlag("aiSupport", checked);
        if (!checked) {
          // turn off autocomplete if AI support is not checked
          setAIAutocompleteActive(false);
          setFlag("aiAutocomplete", false);
        }
      },
      [setFlag, setAISupportActive],
    );

    const handleAIAutocompleteChecked = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const checked = e.currentTarget.checked;
        setAIAutocompleteActive(checked);
        setFlag("aiAutocomplete", checked);
      },
      [setFlag, setAIAutocompleteActive],
    );

    const handleError = useCallback(
      (err: string | Error) => {
        const msg = typeof err === "string" ? err : err.message;
        if (showAlert) showAlert(msg);
      },
      [showAlert],
    );

    const [customProviders, setLocalCustomProviders] = useState<
      CustomLLMProviderSpec[]
    >([]);
    const refreshLLMProviderLists = useCallback(() => {
      // We unfortunately have to force all prompt/chat nodes to refresh their LLM lists, bc
      // apparently the update to the AvailableLLMs list is not immediately propagated to them.
      const prompt_nodes = nodes.filter(
        (n) => n.type === "prompt" || n.type === "chat",
      );
      prompt_nodes.forEach((n) =>
        setDataPropsForNode(n.id, { refreshLLMList: true }),
      );
    }, [nodes, setDataPropsForNode]);

    const handleRemoveCustomProvider = useCallback(
      (name: string) => {
        removeCustomProvider(name)
          .then(() => {
            // Successfully deleted the custom provider from backend;
            // now updated the front-end UI to reflect this:
            setAvailableLLMs(AvailableLLMs.filter((p) => p.name !== name));
            setLocalCustomProviders(
              customProviders.filter((p) => p.name !== name),
            );
            refreshLLMProviderLists();
          })
          .catch(handleError);
      },
      [customProviders, handleError, AvailableLLMs, refreshLLMProviderLists],
    );

    // On init
    useEffect(() => {
      if (APP_IS_RUNNING_LOCALLY() && !LOADED_CUSTOM_PROVIDERS) {
        LOADED_CUSTOM_PROVIDERS = true;
        // Is running locally; try to load any custom providers.
        // Soft fails if it encounters error:
        loadCachedCustomProviders()
          .then((providers) => {
            // Success; pass custom providers list to store:
            setCustomProviders(providers);
            setLocalCustomProviders(providers);
          })
          .catch(console.error);
      }

      // Load image compression settings from cache (if possible)
      const cachedImgCompr = (
        StorageCache.loadFromLocalStorage("imageCompression") as Dict
      )?.value as boolean | undefined;
      if (typeof cachedImgCompr === "boolean") {
        setImageCompression(cachedImgCompr);
        StorageCache.store(
          "imageCompression",
          cachedImgCompr ?? imageCompression,
        );
      }
    }, []);

    const form = useForm({
      initialValues: {
        OpenAI: "",
        OpenAI_BaseURL: "",
        Anthropic: "",
        Google: "",
        Azure_OpenAI: "",
        Azure_OpenAI_Endpoint: "",
        HuggingFace: "",
        AlephAlpha: "",
        AWS_Access_Key_ID: "",
        AWS_Secret_Access_Key: "",
        AWS_Session_Token: "",
        AWS_Region: "us-east-1",
        AmazonBedrock: JSON.stringify({ credentials: {}, region: "us-east-1" }),
      },

      validate: {
        // email: (value) => (/^\S+@\S+$/.test(value) ? null : 'Invalid email'),
      },
    });

    // When the API settings form is submitted
    const onSubmit = (values: Dict<string>) => {
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
      <Modal
        size="lg"
        keepMounted
        opened={opened}
        onClose={close}
        title="ChainForge Settings"
        closeOnClickOutside={false}
        style={{ position: "relative", left: "-5%" }}
      >
        <Box mx="auto">
          <Tabs defaultValue="api-keys">
            <Tabs.List>
              <Tabs.Tab value="api-keys">API Keys</Tabs.Tab>
              <Tabs.Tab value="ai-support">AI Support (BETA)</Tabs.Tab>
              <Tabs.Tab value="custom-providers">Custom Providers</Tabs.Tab>
              <Tabs.Tab value="advanced">Advanced</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="api-keys" pt="xs">
              <Text mb="md" fz="xs" lh={1.15} color="dimmed">
                Note: <b>We do not store your API keys</b> &mdash;not in a
                cookie, localStorage, or server. Because of this,{" "}
                <b>
                  you must set your API keys every time you load ChainForge.
                </b>{" "}
                If you prefer not to worry about it, we recommend{" "}
                <a
                  href="https://github.com/ianarawjo/ChainForge"
                  target="_blank"
                  style={_LINK_STYLE}
                  rel="noreferrer"
                >
                  installing ChainForge locally
                </a>{" "}
                and
                <a
                  href="https://github.com/ianarawjo/ChainForge/blob/main/INSTALL_GUIDE.md#2-set-api-keys-openai-anthropic-google-palm"
                  target="_blank"
                  style={_LINK_STYLE}
                  rel="noreferrer"
                >
                  {" "}
                  setting your API keys as environment variables.
                </a>
              </Text>
              <form onSubmit={form.onSubmit(onSubmit)}>
                <TextInput
                  label="OpenAI API Key"
                  placeholder="Paste your OpenAI API key here"
                  {...form.getInputProps("OpenAI")}
                />
                <br />

                <TextInput
                  label="OpenAI Base URL"
                  description="Note: This is rarely changed."
                  placeholder="Paste a different base URL to use for OpenAI calls"
                  {...form.getInputProps("OpenAI_BaseURL")}
                />

                <br />
                <TextInput
                  label="HuggingFace API Key"
                  placeholder="Paste your HuggingFace API key here"
                  {...form.getInputProps("HuggingFace")}
                />

                <br />
                <TextInput
                  label="Anthropic API Key"
                  placeholder="Paste your Anthropic API key here"
                  {...form.getInputProps("Anthropic")}
                />

                <br />
                <TextInput
                  label="Google AI API Key (PaLM/GEMINI)"
                  placeholder="Paste your Google PaLM/GEMINI API key here"
                  {...form.getInputProps("Google")}
                />
                <br />
                <TextInput
                  label="Aleph Alpha API Key"
                  placeholder="Paste your Aleph Alpha API key here"
                  {...form.getInputProps("AlephAlpha")}
                />
                <br />
                <TextInput
                  label="Together API Key"
                  placeholder="Paste your Together API key here"
                  {...form.getInputProps("Together")}
                />
                <br />

                <Divider
                  my="xs"
                  label="Amazon Web Services"
                  labelPosition="center"
                />
                <TextInput
                  description={
                    "AWS credentials are used to access the AWS API. You must use" +
                    "temporary credentials and associated to an IAM role with the" +
                    "right permission."
                  }
                  label="AWS Access Key ID"
                  placeholder="Paste your AWS Access Key ID here"
                  {...form.getInputProps("AWS_Access_Key_ID")}
                  style={{ marginBottom: "8pt" }}
                />

                <TextInput
                  label="AWS Secret Access Key"
                  placeholder="Paste your AWS Secret Access Key here"
                  {...form.getInputProps("AWS_Secret_Access_Key")}
                  style={{ marginBottom: "8pt" }}
                />

                <TextInput
                  label="AWS Session Token"
                  placeholder="Paste your AWS Session Token here"
                  {...form.getInputProps("AWS_Session_Token")}
                  style={{ marginBottom: "8pt" }}
                />

                <TextInput
                  label="AWS Region"
                  placeholder="Paste your AWS Region here"
                  {...form.getInputProps("AWS_Region")}
                />
                <br />
                <Divider
                  my="xs"
                  label="Microsoft Azure"
                  labelPosition="center"
                />
                <TextInput
                  label="Azure OpenAI Key"
                  description={
                    <span>
                      For more details on Azure OpenAI, see{" "}
                      <a
                        href="https://learn.microsoft.com/en-us/azure/cognitive-services/openai/how-to/create-resource?pivots=web-portal"
                        target="_blank"
                        style={{ color: "#1E90FF", textDecoration: "none" }}
                        rel="noreferrer"
                      >
                        Microsoft Learn.
                      </a>{" "}
                      Note that you will have to set the Deployment Name in the
                      Settings of any Azure OpenAI model you add to a Prompt
                      Node.
                    </span>
                  }
                  placeholder="Paste your Azure OpenAI Key here"
                  {...form.getInputProps("Azure_OpenAI")}
                  style={{ marginBottom: "8pt" }}
                />

                <TextInput
                  label="Azure OpenAI Endpoint"
                  placeholder="Paste your Azure OpenAI Endpoint here"
                  {...form.getInputProps("Azure_OpenAI_Endpoint")}
                />

                <Group position="right" mt="md">
                  <Button type="submit">Submit</Button>
                </Group>
              </form>
            </Tabs.Panel>

            <Tabs.Panel value="ai-support" pt="xs">
              <Text mb="md" fz="sm" lh={1.3}>
                AI support features in ChainForge include purple sparkly buttons{" "}
                <IconSparkles size="10pt" /> and smart autocomplete. By default,
                AI support features require OpenAI API access to call GPT3.5 and
                GPT4 models. You can hide, disable, or change these features
                here.
              </Text>
              <Switch
                label="AI Support Features"
                size="sm"
                description="Adds purple sparkly AI buttons to nodes. These buttons allow you to generate in-context data or code."
                checked={aiSupportActive}
                onChange={handleAISupportChecked}
              />
              {aiSupportActive ? (
                <Group>
                  <Switch
                    label="Autocomplete"
                    size="sm"
                    mt="sm"
                    disabled={!aiSupportActive}
                    description="Works in background to streamline generation of input data. Press Tab in TextFields Nodes in empty fields to extend input data (currently only works in TextFields). NOTE: This will make OpenAI API calls in the background. We are not responsible for any additional costs incurred."
                    checked={aiAutocompleteActive}
                    onChange={handleAIAutocompleteChecked}
                  />
                  <Select
                    label="LLM Provider"
                    description="The LLM provider to use for generative AI features. Currently only supports OpenAI and Bedrock (Anthropic). OpenAI will query gpt-4o and gpt-4 models. Bedrock will query Claude-3 models. You must have set the relevant API keys to use the provider."
                    dropdownPosition="bottom"
                    withinPortal
                    defaultValue={getAIFeaturesModelProviders()[0]}
                    data={getAIFeaturesModelProviders()}
                    value={aiFeaturesProvider}
                    onChange={setAIFeaturesProvider}
                  ></Select>
                </Group>
              ) : (
                <></>
              )}
            </Tabs.Panel>

            {APP_IS_RUNNING_LOCALLY() ? (
              <Tabs.Panel value="custom-providers" pt="md">
                <Text mb="md" fz="sm" lh={1.3}>
                  You can add model providers to ChainForge by writing custom
                  completion functions as Python scripts. (You can even make
                  your own settings screen!) To learn more,{" "}
                  <a
                    href="https://chainforge.ai/docs/custom_providers/"
                    target="_blank"
                    style={_LINK_STYLE}
                    rel="noreferrer"
                  >
                    see the documentation.
                  </a>
                </Text>
                {customProviders.map((p) => (
                  <Card
                    key={p.name}
                    shadow="sm"
                    radius="sm"
                    pt="0px"
                    pb="4px"
                    mb="md"
                    withBorder
                  >
                    <Group position="apart">
                      <Group position="left" mt="md" mb="xs">
                        <Text w="10px">{p.emoji}</Text>
                        <Text weight={500}>{p.name}</Text>
                        {p.settings_schema ? (
                          <Badge color="blue" variant="light">
                            has settings
                          </Badge>
                        ) : (
                          <></>
                        )}
                      </Group>
                      <Button
                        onClick={() => handleRemoveCustomProvider(p.name)}
                        color="red"
                        p="0px"
                        mt="4px"
                        variant="subtle"
                      >
                        <IconX />
                      </Button>
                    </Group>
                  </Card>
                ))}
                <CustomProviderScriptDropzone
                  onError={handleError}
                  onSetProviders={(ps: CustomLLMProviderSpec[]) => {
                    refreshLLMProviderLists();
                    setLocalCustomProviders(ps);
                  }}
                />
              </Tabs.Panel>
            ) : (
              <></>
            )}

            <Tabs.Panel value="advanced" pt="xs">
              <Box p="md">
                <Checkbox
                  label="Image compression"
                  description="Images are expensive to store in the browser. To help with storage, 
                  ChainForge automatically compresses images output from LLMs."
                  checked={imageCompression}
                  onChange={(event) =>
                    setImageCompression(event.currentTarget.checked)
                  }
                />
              </Box>
            </Tabs.Panel>
          </Tabs>
        </Box>
      </Modal>
    );
  },
);

export default GlobalSettingsModal;
