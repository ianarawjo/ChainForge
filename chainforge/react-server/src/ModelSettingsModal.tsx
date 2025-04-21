import React, {
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useEffect,
} from "react";
import { Button, Flex, Modal, Popover, Select, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import emojidata from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
// react-jsonschema-form
import validator from "@rjsf/validator-ajv8";
import Form from "@rjsf/core";
import { WidgetProps } from "@rjsf/utils";
import {
  ModelSettings,
  getDefaultModelFormData,
  postProcessFormData,
} from "./ModelSettingSchemas";
import {
  Dict,
  JSONCompatible,
  LLMSpec,
  ModelSettingsDict,
} from "./backend/typing";
import { IconHeart } from "@tabler/icons-react";
import { APP_IS_RUNNING_LOCALLY } from "./backend/utils";

const IS_RUNNING_LOCALLY = APP_IS_RUNNING_LOCALLY();

// Custom UI widgets for react-jsonschema-form
const DatalistWidget = (props: WidgetProps) => {
  const [data, setData] = useState(
    (
      props.options.enumOptions?.map((option, index) => ({
        value: option.value,
        label: option.value,
      })) ?? []
    ).concat(
      props.options.enumOptions?.find((o) => o.value === props.value)
        ? []
        : { value: props.value, label: props.value },
    ),
  );

  return (
    <Select
      data={data}
      defaultValue={props.value ?? ""}
      onChange={(newVal) => props.onChange(newVal ?? "")}
      size="sm"
      placeholder="Select items"
      nothingFound="Nothing found"
      searchable
      creatable
      getCreateLabel={(query) => `+ Create ${query}`}
      onCreate={(query) => {
        const item = { value: query, label: query };
        setData((current) => [...current, item]);
        console.log(item);
        return item;
      }}
    />
  );
};

const widgets = {
  datalist: DatalistWidget,
};

export interface ModelSettingsModalRef {
  trigger: () => void;
}
export interface ModelSettingsModalProps {
  model?: LLMSpec;
  onSettingsSubmit?: (
    savedItem: LLMSpec,
    formData: Dict<JSONCompatible>,
    settingsData: Dict<JSONCompatible>,
    makeFavorite?: boolean,
  ) => void;
}
type FormData = LLMSpec["formData"];

const ModelSettingsModal = forwardRef<
  ModelSettingsModalRef,
  ModelSettingsModalProps
>(function ModelSettingsModal({ model, onSettingsSubmit }, ref) {
  const [opened, { open, close }] = useDisclosure(false);

  const [formData, setFormData] = useState<FormData>(undefined);

  const [schema, setSchema] = useState<ModelSettingsDict["schema"]>({
    type: "object",
    description: "No model info object was passed to settings modal.",
    required: [],
    properties: {},
  });
  const [uiSchema, setUISchema] = useState<ModelSettingsDict["uiSchema"]>({});
  const [baseModelName, setBaseModelName] = useState("(unknown)");

  const [initShortname, setInitShortname] = useState<string | undefined>(
    undefined,
  );
  const [initModelName, setInitModelName] = useState<string | undefined>(
    undefined,
  );

  // Totally necessary emoji picker
  const [modelEmoji, setModelEmoji] = useState("");
  const [emojiPickerOpen, setEmojiPickerOpen] = useState<boolean>(false);

  useEffect(() => {
    if (model && model.base_model) {
      setModelEmoji(model.emoji);
      if (!(model.base_model in ModelSettings)) {
        setSchema({
          type: "object",
          description: `Did not find settings schema for base model ${model.base_model}. Maybe you are missing importing a custom provider script?`,
          required: [],
          properties: {},
        });
        setUISchema({});
        setBaseModelName(model.base_model);
        return;
      }
      const settingsSpec = ModelSettings[model.base_model];
      const schema = settingsSpec.schema;
      setSchema(schema);
      setUISchema(settingsSpec.uiSchema);
      setBaseModelName(settingsSpec.fullName);

      // If the user has already saved custom settings...
      if (model.formData) {
        setFormData(model.formData);
        setInitShortname(model.formData.shortname as string | undefined);

        // If the "custom_model" field is set, use that as the initial model name, overriding "model".
        // if (string_exists(model.formData.custom_model))
        // setInitModelName(model.formData.custom_model as string);
        // else
        setInitModelName(model.formData.model as string | undefined);
      } else {
        // Create settings from schema
        const default_settings: Dict<JSONCompatible | undefined> = {};
        Object.keys(schema.properties).forEach((key) => {
          default_settings[key] =
            "default" in schema.properties[key]
              ? schema.properties[key].default
              : undefined;
        });
        setInitShortname(default_settings.shortname?.toString());
        setInitModelName(default_settings.model?.toString());
        setFormData(getDefaultModelFormData(settingsSpec));
      }
    }
  }, [model]);

  // Postprocess the form data into the format expected by the backend (kwargs passed to Python API calls)
  const postprocess = useCallback(
    (fdata: FormData) => {
      if (model === undefined) return {};
      return postProcessFormData(ModelSettings[model.base_model], fdata ?? {});
    },
    [model],
  );

  const saveFormState = useCallback(
    (fdata: FormData, makeFavorite?: boolean) => {
      if (fdata === undefined) return;
      // For some reason react-json-form-schema returns 'undefined' on empty strings.
      // We need to (1) detect undefined values for keys in formData and (2) if they are of type string, replace with "",
      // if that property is marked with a special "allow_empty_str" property.
      const patched_fdata: FormData = {};
      Object.entries(fdata).forEach(([key, val]) => {
        if (
          val === undefined &&
          key in schema.properties &&
          schema.properties[key].allow_empty_str === true
        )
          patched_fdata[key] = "";
        else patched_fdata[key] = val;
      });

      setFormData(patched_fdata);

      if (onSettingsSubmit && model !== undefined) {
        model.emoji = modelEmoji;
        onSettingsSubmit(
          model,
          patched_fdata,
          postprocess(patched_fdata),
          makeFavorite,
        );
      }
    },
    [model, modelEmoji, schema, setFormData, onSettingsSubmit, postprocess],
  );

  const onSubmit = useCallback(
    (submitInfo: LLMSpec) => {
      saveFormState(submitInfo.formData);
    },
    [saveFormState],
  );

  // On every edit to the form...
  const onFormDataChange = (state: LLMSpec) => {
    if (state && state.formData) {
      // This checks if the model name has changed, but the shortname wasn't edited (in this window).
      // In this case, we auto-change the shortname, to save user's time and nickname models appropriately.
      const modelname = state.formData.model as string | undefined;
      const shortname = state.formData.shortname as string | undefined;
      if (shortname === initShortname && modelname !== initModelName) {
        // Only change the shortname if there is a distinct model name.
        // If not, let the shortname remain the same for this time, and just remember the model name.
        if (initModelName !== undefined) {
          const shortname_map = schema.properties?.model
            ?.shortname_map as Dict<string>;
          if (
            shortname_map &&
            modelname !== undefined &&
            modelname in shortname_map
          )
            state.formData.shortname = shortname_map[modelname];
          else state.formData.shortname = modelname?.split("/").at(-1);
          setInitShortname(shortname);
        }

        setInitModelName(modelname);
      }

      setFormData(state.formData);
    }
  };

  const onClickSubmit = useCallback(
    (makeFavorite?: boolean) => {
      if (formData) saveFormState(formData, makeFavorite);
      close();
    },
    [formData, close, saveFormState],
  );

  const onEmojiSelect = useCallback(
    (selection: Dict) => {
      const emoji = selection.native;
      setModelEmoji(emoji);
      setEmojiPickerOpen(false);
    },
    [setModelEmoji, setEmojiPickerOpen],
  );

  // This gives the parent access to triggering the modal
  const trigger = useCallback(() => {
    open();
  }, [schema, uiSchema, baseModelName, open]);
  useImperativeHandle(ref, () => ({
    trigger,
  }));

  return (
    <Modal.Root size="lg" opened={opened} onClose={() => onClickSubmit(false)}>
      <Modal.Overlay />
      <Modal.Content>
        <Modal.Header>
          <Modal.Title>
            <div className="nowheel nodrag">
              <Popover
                width={200}
                position="bottom"
                withArrow
                shadow="md"
                withinPortal
                opened={emojiPickerOpen}
                onChange={setEmojiPickerOpen}
              >
                <Popover.Target>
                  <Button
                    variant="subtle"
                    compact
                    style={{ fontSize: "16pt" }}
                    onClick={() => {
                      setEmojiPickerOpen((o: boolean) => !o);
                    }}
                  >
                    {modelEmoji}
                  </Button>
                </Popover.Target>
                <Popover.Dropdown>
                  <Picker
                    data={emojidata}
                    onEmojiSelect={onEmojiSelect}
                    theme="light"
                  />
                </Popover.Dropdown>
              </Popover>
              <span>{`Model Settings: ${baseModelName}`}</span>
            </div>
          </Modal.Title>

          <Flex justify="right">
            {IS_RUNNING_LOCALLY && (
              <Tooltip
                label="Save as a favorite. Uses the nickname, so make sure it's good."
                withArrow
                multiline
                maw="220px"
              >
                <Button
                  className="favorite-icon"
                  fw="normal"
                  mr="md"
                  variant="outline"
                  size="xs"
                  color="gray"
                  rightIcon={<IconHeart size="12pt" />}
                  onClick={() => {
                    // Submit the form and make the saved model settings a favorite
                    onClickSubmit(true);
                  }}
                >
                  Favorite
                </Button>
              </Tooltip>
            )}
            <Modal.CloseButton />
          </Flex>
        </Modal.Header>
        <Modal.Body>
          <Form
            schema={schema}
            uiSchema={uiSchema}
            widgets={widgets} // Custom UI widgets
            formData={formData}
            // // @ts-expect-error This is literally the example code from react-json-schema; no idea why it wouldn't typecheck correctly.
            validator={validator}
            // @ts-expect-error Expect format is LLMSpec.
            onChange={onFormDataChange}
            // @ts-expect-error Expect format is LLMSpec.
            onSubmit={onSubmit}
            style={{ width: "100%" }}
          >
            <Button
              title="Submit"
              onClick={() => onClickSubmit(false)}
              style={{ float: "right", marginRight: "30px" }}
            >
              Submit
            </Button>
            <div style={{ height: "50px" }}></div>
          </Form>
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  );
});

export default ModelSettingsModal;
