import React, { forwardRef, useEffect, useImperativeHandle } from "react";
import { Modal, TextInput, Button, Box, Group } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useDisclosure } from "@mantine/hooks";

export interface RenameValueModalProps {
  initialValue: string;
  title: string;
  label: string;
  onSubmit?: (val: string) => void;
}

export interface RenameValueModalRef {
  trigger: (msg?: string) => void;
}

/** Modal that lets user rename a single value, using a TextInput field. */
const RenameValueModal = forwardRef<RenameValueModalRef, RenameValueModalProps>(
  function RenameValueModal({ initialValue, title, label, onSubmit }, ref) {
    const [opened, { open, close }] = useDisclosure(false);
    const form = useForm({
      initialValues: {
        value: initialValue,
      },
      validate: {
        value: (v) =>
          v.trim().length > 0
            ? null
            : "Column names must have at least one character",
      },
    });

    useEffect(() => {
      form.setValues({ value: initialValue });
    }, [initialValue]);

    // This gives the parent access to triggering the modal alert
    const trigger = () => {
      open();
    };
    useImperativeHandle(ref, () => ({
      trigger,
    }));

    return (
      <Modal opened={opened} onClose={close} title={title}>
        <Box maw={300} mx="auto">
          <form
            onSubmit={form.onSubmit((values) => {
              if (onSubmit) onSubmit(values.value);
              close();
            })}
          >
            <TextInput
              withAsterisk
              label={label}
              autoFocus={true}
              {...form.getInputProps("value")}
            />

            <Group position="right" mt="md">
              <Button type="submit">Submit</Button>
            </Group>
          </form>
        </Box>
      </Modal>
    );
  },
);

export default RenameValueModal;
