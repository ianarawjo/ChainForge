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
  Checkbox,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useForm } from "@mantine/form";
import {
  IconUpload,
  IconBrandPython,
  IconX,
  IconBrandGithub,
  IconBook,
} from "@tabler/icons-react";
import { Dropzone, FileWithPath } from "@mantine/dropzone";
import useStore, { initLLMProviderMenu } from "./store";
import { APP_IS_RUNNING_LOCALLY, clear_api_keys } from "./backend/utils";
import {
  forgetStoredAPIKeys,
  loadStoredAPIKeys,
  storeAPIKeys,
} from "./backend/apiKeyStorage";
import { setCustomProviders } from "./ModelSettingSchemas";
import AISupportSettings from "./AISupportSettings";
import { AIModelOverrides } from "./backend/aiModels";
import { CustomLLMProviderSpec, Dict, JSONCompatible } from "./backend/typing";
import {
  getGlobalConfig,
  initCustomProvider,
  loadCachedCustomProviders,
  removeCustomProvider,
  saveGlobalConfig,
} from "./backend/backend";
import { AlertModalContext } from "./AlertModal";
import { ColorSchemeToggle } from "./ColorThemeProvider";

// Type for the non-form (non-sensitive) settings
interface GlobalSettingsType {
  aiSupport: boolean;
  imageCompression: boolean;
  // The provider for AI support features; blank to pick one from the API keys
  aiProvider: string;
  aiModels: AIModelOverrides;
}

// The JSON filename in the backend for the global settings
const SETTINGS_FILENAME = "settings";

// Where the web version keeps the non-sensitive settings (not API keys; see
// apiKeyStorage), since it has no backend to save them to.
const WEB_SETTINGS_STORAGE_KEY = "chainforge-settings";

function loadWebSettings(): Partial<GlobalSettingsType> {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(WEB_SETTINGS_STORAGE_KEY) ?? "{}",
    );
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function saveWebSettings(settings: GlobalSettingsType): void {
  try {
    window.localStorage.setItem(
      WEB_SETTINGS_STORAGE_KEY,
      JSON.stringify(settings),
    );
  } catch {
    /* storage unavailable: settings last until the page reloads */
  }
}

// The init function may be called twice, so we need to
// make sure we only load the settings once.
let INIT_ONCE = false;

const _LINK_STYLE = { color: "#1E90FF", textDecoration: "none" };
const IS_RUNNING_LOCALLY = APP_IS_RUNNING_LOCALLY();

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

// Normalize backend providers to the store shape for *retrievers* (preserves schema)
function toCustomRetrieverSpecs(providers: any[]) {
  return (providers || [])
    .filter((p: any) => p.category === "retriever")
    .map((p: any) => ({
      key: `__custom/${p.name}`,
      baseMethod: `__custom/${p.name}`,
      methodName: p.name,
      library: p.name,
      emoji: p.emoji ?? "✨",
      // optional; safe default
      needsEmbeddingModel: !!p.needs_embedding_model,
      // keep schema + defaults
      settings_schema: p.settings_schema ?? undefined,
      default_settings: p.default_settings ?? undefined,
    }));
}

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
  const setCustomChunkers = useStore((state) => state.setCustomChunkers);
  const setCustomRetrievers = useStore((s) => s.setCustomRetrievers);

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

                // PUSH ANY chunker‑category providers into the global store
                setCustomChunkers(
                  providers
                    .filter((p) => p.category === "chunker")
                    .map((p) => ({
                      key: `__custom/${p.name}`,
                      baseMethod: `__custom/${p.name}`,
                      methodType: "chunker",
                      name: p.name,
                      emoji: p.emoji,
                      settings: {},
                    })),
                );
                setCustomRetrievers(toCustomRetrieverSpecs(providers));
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
    // The first tab's form
    const form = useForm({
      initialValues: {
        OpenAI: "",
        OpenAI_BaseURL: "",
        Anthropic: "",
        Google: "",
        Azure_OpenAI: "",
        Azure_OpenAI_Endpoint: "",
        HuggingFace: "",
        Ollama_BaseURL: "",
        AWS_Access_Key_ID: "",
        AWS_Secret_Access_Key: "",
        AWS_Session_Token: "",
        AWS_Region: "us-east-1",
        AmazonBedrock: JSON.stringify({ credentials: {}, region: "us-east-1" }),
        Together: "",
        DeepSeek: "",
        MiniMax: "",
        OpenRouter: "",
        Cohere: "",
      },

      validate: {
        // Example:
        // email: (value) => (/^\S+@\S+$/.test(value) ? null : 'Invalid email'),
      },
    });

    // Settings within the other tabs
    const [settings, setSettings] = useState<GlobalSettingsType>({
      aiSupport: true,
      imageCompression: true,
      aiProvider: "",
      aiModels: {},
    });

    // Fetch the global settings from the backend
    const loadSettingsFromBackend = useCallback(() => {
      // Load global settings from backend. This fails silently if the backend is not running.
      // It also will only load settings that the form has defined.
      getGlobalConfig(SETTINGS_FILENAME)
        .then((backendSettings) => {
          // Set the settings in the first tab's form (mainly API key list)
          Object.keys(form.values).forEach((key) => {
            if (key in backendSettings)
              form.setFieldValue(key, backendSettings[key]);
          });

          // Set any other settings that are on other pages (not in the form)
          setSettings((prev) => {
            const loaded = { ...prev };
            (Object.keys(prev) as (keyof GlobalSettingsType)[]).forEach(
              (key) => {
                if (key in backendSettings)
                  (loaded as Dict)[key] = backendSettings[key];
              },
            );
            // Nodes read these from the store.
            setGlobalSettingsInZustandStore(loaded);
            return loaded;
          });

          // Set any API keys that were custom set in the global settings form,
          // overriding the default ones (including environment variables).
          setAPIKeys(backendSettings as Dict<string>);

          console.log("Loaded global settings from backend.");

          return backendSettings;
        })
        .then((backendSettings) => {
          // Attempt to fetch Ollama model list
          // TODO: This should use the Ollama BaseURL setting
          const Ollama_BaseURL =
            backendSettings.Ollama_BaseURL || "http://localhost:11434";
          fetch(`${Ollama_BaseURL}/api/tags`)
            .then((response) => {
              if (response.ok) {
                return response.json();
              } else {
                throw new Error("Server not running?");
              }
            })
            .then((data) => {
              const models_available = data.models?.map(
                (model_obj: Dict) => model_obj.name,
              );

              if (models_available.length === 0) {
                console.log("No Ollama models available.");
                return;
              }
              setOllamaModels(models_available);

              // Set the available models in the global provider menu,
              // by replacing the default Ollama generic model with the model list from the server.
              const ollama_item = initLLMProviderMenu.findIndex(
                (item) => "base_model" in item && item.base_model === "ollama",
              );
              if (ollama_item !== -1) {
                initLLMProviderMenu[ollama_item] = {
                  group: "Ollama",
                  emoji: "🦙",
                  items: models_available.map((model: string, idx: number) => ({
                    key: idx,
                    name: model,
                    emoji: "🦙",
                    model: "ollama",
                    base_model: "ollama",
                    formData: {
                      ollamaModel: model,
                    },
                    settings: {
                      ollamaModel: model,
                    },
                    temp: 1.0,
                  })),
                };
              }

              console.log("Ollama models available:", models_available);
              console.log("Loaded Ollama model list from backend.");
            })
            .catch((error) => {
              console.error("Error trying to fetch Ollama models", error);
            });
        });
    }, [form, settings]);

    // Save the global settings to the backend
    const saveGlobalSettingsToBackend = useCallback(
      (settingsToSave?: Dict<JSONCompatible>) => {
        // Save global settings to backend. This fails silently if the backend is not running.
        // Mixes the settings from the form and the other tabs.
        if (!settingsToSave)
          settingsToSave = {
            ...form.values,
            ...settings,
          };
        saveGlobalConfig(SETTINGS_FILENAME, settingsToSave);
      },
      [form, settings],
    );

    // Set the settings in the store and synchronize to backend
    const setGlobalSettingsInZustandStore = useStore(
      (state) => state.setGlobalSettings,
    );
    const handleChangeSetting = useCallback(
      (key: string, value: JSONCompatible) => {
        setSettings((prev) => {
          const updated = { ...prev, [key]: value };

          if (IS_RUNNING_LOCALLY) {
            // Synchronize the settings to the backend
            saveGlobalSettingsToBackend({
              ...form.values,
              ...updated,
            });
          } else saveWebSettings(updated);

          // Store the non-form settings in the Zustand store global state,
          // so other components can access them and immediately react to the change.
          setGlobalSettingsInZustandStore(updated);

          return updated;
        });
      },
      [form],
    );

    const [opened, { open, close }] = useDisclosure(false);
    const setAPIKeys = useStore((state) => state.setAPIKeys);
    const clearAPIKeys = useStore((state) => state.clearAPIKeys);
    // Web version only: keep keys on this device, rather than for this tab.
    const [rememberKeys, setRememberKeys] = useState(false);
    const AvailableLLMs = useStore((state) => state.AvailableLLMs);
    const setOllamaModels = useStore((state) => state.setOllamaModels);
    const setAvailableLLMs = useStore((state) => state.setAvailableLLMs);
    const setFavorites = useStore((state) => state.setFavorites);
    const nodes = useStore((state) => state.nodes);
    const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);

    const showAlert = useContext(AlertModalContext);

    const handleError = useCallback(
      (err: string | Error) => {
        const msg = typeof err === "string" ? err : err.message;
        if (showAlert) showAlert(msg);
      },
      [showAlert],
    );

    const setCustomChunkers = useStore((s) => s.setCustomChunkers);
    const setCustomRetrievers = useStore((s) => s.setCustomRetrievers);

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
            setCustomChunkers(
              customProviders
                .filter((p) => p.name !== name) // remaining providers
                .filter((p) => p.category === "chunker") // only chunkers
                .map((p) => ({
                  key: `__custom/${p.name}`,
                  baseMethod: `__custom/${p.name}`,
                  methodType: "chunker",
                  name: p.name,
                  emoji: p.emoji,
                  settings: {},
                })),
            );
            setCustomRetrievers(
              toCustomRetrieverSpecs(
                customProviders.filter((p) => p.name !== name),
              ),
            );
            refreshLLMProviderLists();
          })
          .catch(handleError);
      },
      [customProviders, handleError, AvailableLLMs, refreshLLMProviderLists],
    );

    // On init, load global settings
    useEffect(() => {
      if (!IS_RUNNING_LOCALLY || INIT_ONCE) return;

      INIT_ONCE = true;

      if (!LOADED_CUSTOM_PROVIDERS) {
        LOADED_CUSTOM_PROVIDERS = true;
        // Is running locally; try to load any custom providers.
        // Soft fails if it encounters error:
        loadCachedCustomProviders()
          .then((providers) => {
            // Success; pass custom providers list to store:
            setCustomProviders(providers);
            setLocalCustomProviders(providers);
            setCustomRetrievers(toCustomRetrieverSpecs(providers));
          })
          .catch(console.error);
      }

      // Load global settings from backend, if it exists
      // NOTE: This deliberately does not have a backup for the web-only version,
      // since saving this data to localStorage would be a security risk.
      loadSettingsFromBackend();

      // Fetch favorites list from backend
      getGlobalConfig("favorites").then((favorites: any) => {
        console.warn(favorites);
        if (!favorites) return;
        // If there's some, set the favorites in the store
        setFavorites(favorites);

        console.log("Loaded favorites from backend.");
      });
    }, []);

    // The web version has no backend to save settings to, so it restores them
    // from the browser: API keys from this tab (or the device, if the user
    // chose to remember them), and the other settings from the device.
    useEffect(() => {
      if (IS_RUNNING_LOCALLY) return;
      const { keys, remembered } = loadStoredAPIKeys();
      Object.entries(keys).forEach(([name, value]) => {
        if (name in form.values) form.setFieldValue(name, value);
      });
      if (Object.keys(keys).length > 0) setAPIKeys(keys);
      setRememberKeys(remembered);

      const saved = loadWebSettings();
      setSettings((prev) => {
        const restored = { ...prev };
        (Object.keys(prev) as (keyof GlobalSettingsType)[]).forEach((key) => {
          if (key in saved) (restored as Dict)[key] = saved[key];
        });
        // Nodes read these from the store.
        setGlobalSettingsInZustandStore(restored);
        return restored;
      });
    }, []);

    // When the API settings form is submitted
    const onSubmit = (values: Dict<string>) => {
      // Pasted keys often bring a stray space or line break along.
      const trimmed = Object.fromEntries(
        Object.entries(values).map(([name, value]) => [
          name,
          typeof value === "string" ? value.trim() : value,
        ]),
      );
      form.setValues(trimmed);

      // Override existing API keys with any new ones
      setAPIKeys(trimmed);

      if (IS_RUNNING_LOCALLY) {
        // Save to the backend along with the other tabs' settings, which share
        // the file (saving the keys alone dropped them). Fails silently if the
        // backend is not running.
        saveGlobalSettingsToBackend({ ...trimmed, ...settings });
      } else {
        storeAPIKeys(trimmed, rememberKeys);
      }

      // Close the modal
      close();
    };

    // Web version: forget the keys entered here, stored or not.
    const forgetKeys = () => {
      forgetStoredAPIKeys();
      clearAPIKeys();
      clear_api_keys();
      form.reset();
      setRememberKeys(false);
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
        title={
          <Flex align="center" gap="md">
            <Text>ChainForge Settings</Text>
            <ColorSchemeToggle />
          </Flex>
        }
        closeOnClickOutside={false}
      >
        <Box mx="auto">
          <Tabs defaultValue="api-keys">
            <Tabs.List>
              <Tabs.Tab value="api-keys">API Keys</Tabs.Tab>
              <Tabs.Tab value="ai-support">AI Support</Tabs.Tab>
              <Tabs.Tab value="custom-providers">Custom Providers</Tabs.Tab>
              <Tabs.Tab value="advanced">Advanced</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="api-keys" pt="xs">
              {IS_RUNNING_LOCALLY ? (
                <Text mb="md" fz="xs" lh={1.15} color="dimmed">
                  Keys entered here are saved with your ChainForge settings on
                  this machine. You can also{" "}
                  <a
                    href="https://github.com/ianarawjo/ChainForge/blob/main/INSTALL_GUIDE.md#2-set-api-keys-openai-anthropic-google-palm"
                    target="_blank"
                    style={_LINK_STYLE}
                    rel="noreferrer"
                  >
                    set your API keys as environment variables.
                  </a>
                </Text>
              ) : (
                <Text mb="md" fz="xs" lh={1.15} color="dimmed">
                  Your keys are <b>never sent to ChainForge</b>, only to the
                  providers you query. They are kept in this browser tab, so
                  they survive a reload and are forgotten when you close it. For
                  the most control over your keys,{" "}
                  <a
                    href="https://github.com/ianarawjo/ChainForge"
                    target="_blank"
                    style={_LINK_STYLE}
                    rel="noreferrer"
                  >
                    install ChainForge locally
                  </a>
                  .
                </Text>
              )}
              <form onSubmit={form.onSubmit(onSubmit)}>
                <TextInput
                  label="OpenRouter API Key"
                  description="One key for models from many providers, including image models."
                  placeholder="Paste your OpenRouter API key here"
                  {...form.getInputProps("OpenRouter")}
                />
                <br />

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
                  label="Anthropic API Key"
                  placeholder="Paste your Anthropic API key here"
                  {...form.getInputProps("Anthropic")}
                />

                <br />
                <TextInput
                  label="Google AI API Key (Gemini)"
                  placeholder="Paste your Google Gemini API key here"
                  {...form.getInputProps("Google")}
                />
                <br />
                <TextInput
                  label="DeepSeek API Key"
                  placeholder="Paste your DeepSeek API key here"
                  {...form.getInputProps("DeepSeek")}
                />
                <br />

                <TextInput
                  label="MiniMax API Key"
                  placeholder="Paste your MiniMax API key here"
                  {...form.getInputProps("MiniMax")}
                />
                <br />

                <TextInput
                  label="Cohere API Key"
                  placeholder="Paste your Cohere API key here"
                  {...form.getInputProps("Cohere")}
                />
                <br />

                <TextInput
                  label="HuggingFace API Key"
                  placeholder="Paste your HuggingFace API key here"
                  {...form.getInputProps("HuggingFace")}
                />
                <br />

                <TextInput
                  label="Together API Key"
                  placeholder="Paste your Together API key here"
                  {...form.getInputProps("Together")}
                />
                <br />

                {IS_RUNNING_LOCALLY && (
                  <>
                    <Divider
                      my="xs"
                      label="Ollama Settings"
                      labelPosition="center"
                    />
                    <TextInput
                      label="Ollama Server Base URL"
                      description="ChainForge will attempt to contact the Ollama API at this URL. The default is http://localhost:11434"
                      placeholder="Paste your Ollama Server Base URL here."
                      {...form.getInputProps("Ollama_BaseURL")}
                    />
                    <br />
                  </>
                )}

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
                <br />

                {!IS_RUNNING_LOCALLY && (
                  <Checkbox
                    mt="md"
                    label="Remember my keys on this device"
                    description="Keeps them after the tab closes. Only on a device you trust: anyone using this browser profile, or a browser extension, could read them."
                    checked={rememberKeys}
                    onChange={(e) => setRememberKeys(e.currentTarget.checked)}
                  />
                )}

                <Group position="right" mt="md">
                  {!IS_RUNNING_LOCALLY && (
                    <Button variant="subtle" color="red" onClick={forgetKeys}>
                      Forget my keys
                    </Button>
                  )}
                  <Button type="submit">Submit</Button>
                </Group>
              </form>
            </Tabs.Panel>

            <Tabs.Panel value="ai-support" pt="xs">
              <AISupportSettings
                enabled={settings.aiSupport}
                provider={settings.aiProvider}
                models={settings.aiModels}
                onChange={handleChangeSetting}
              />
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
                {["chunker", "retriever", "model"]
                  .filter((cat) =>
                    customProviders.some((p) => p.category === cat),
                  )
                  .map((cat) => (
                    <React.Fragment key={cat}>
                      <Text weight={600} mt="md" mb="xs">
                        {cat[0].toUpperCase() + cat.slice(1)}
                      </Text>
                      {customProviders
                        .filter((p) => p.category === cat)
                        .map((p) => (
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
                                {p.settings_schema && (
                                  <Badge color="blue" variant="light">
                                    has settings
                                  </Badge>
                                )}
                              </Group>
                              <Button
                                onClick={() =>
                                  handleRemoveCustomProvider(p.name)
                                }
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
                    </React.Fragment>
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
                  checked={(settings.imageCompression as boolean) ?? false}
                  onChange={(e) => {
                    handleChangeSetting(
                      "imageCompression",
                      e.currentTarget.checked,
                    );
                  }}
                />

                <Divider my="xl" label="Resources" labelPosition="center" />

                <Group position="center">
                  <Button
                    component="a"
                    href="https://github.com/ianarawjo/ChainForge"
                    target="_blank"
                    variant="light"
                    leftIcon={<IconBrandGithub size="1.2rem" />}
                  >
                    GitHub Project
                  </Button>

                  <Button
                    component="a"
                    href="https://chainforge.ai/docs/"
                    target="_blank"
                    variant="light"
                    leftIcon={<IconBook size="1.2rem" />}
                  >
                    Documentation
                  </Button>
                </Group>
              </Box>
            </Tabs.Panel>
          </Tabs>
        </Box>
      </Modal>
    );
  },
);

export default GlobalSettingsModal;
