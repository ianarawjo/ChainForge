import React, { useEffect } from "react";
import { Modal, Button, TextInput, Flex, Text } from "@mantine/core";
import { useForm } from "@mantine/form";

export interface RequestClarificationModalProps {
  opened: boolean;
  title: string;
  desc?: string;
  initialValue?: string;
  question: string;
  onSubmit: (answer: string | null) => void;
  validator?: (value: string) => string | null;
}

// Requests clarification on a question before continuing.
const RequestClarificationModal: React.FC<RequestClarificationModalProps> = ({
  opened,
  initialValue,
  title,
  desc,
  question,
  onSubmit,
  validator,
}) => {
  // Create a form with Mantine's useForm hook
  const form = useForm({
    initialValues: {
      answer: "",
    },

    validate: {
      answer: (value: string) => {
        if (value.trim().length === 0) {
          return "You must provide an answer";
        }
        if (validator) {
          return validator(value);
        }
        return null;
      },
    },
  });

  // Update the form value when the initialValue prop changes
  useEffect(() => {
    form.setFieldValue("answer", initialValue ?? "");
  }, [initialValue]);

  // Handle form submission
  const handleSubmit = (values: typeof form.values) => {
    onSubmit(values.answer);
    form.reset();
  };

  return (
    <Modal
      opened={opened}
      onClose={() => {
        form.reset();
      }}
      closeOnEscape={false}
      withCloseButton={false}
      title={title}
      centered
      style={{ position: "relative", left: "-4%" }}
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <TextInput
          label={question}
          description={desc}
          placeholder="Type your answer here"
          {...form.getInputProps("answer")}
        />

        <Flex justify="space-between" mt="md">
          <Button
            variant="light"
            color="gray"
            onClick={(e) => {
              e.preventDefault();
              onSubmit(null);
            }}
          >
            Cancel
          </Button>
          <Button type="submit" color="green">
            Submit
          </Button>
        </Flex>
      </form>
    </Modal>
  );
};

export default RequestClarificationModal;
