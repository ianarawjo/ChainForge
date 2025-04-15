import React, { useEffect } from "react";
import { Modal, Button, TextInput, Flex, Text } from "@mantine/core";
import { useForm } from "@mantine/form";

interface RequestClarificationModalProps {
  opened: boolean;
  title: string;
  desc?: string;
  initialValue?: string;
  question: string;
  onSubmit: (answer: string | null) => void;
}

// Requests clarification on a question before continuing.
const RequestClarificationModal: React.FC<RequestClarificationModalProps> = ({
  opened,
  initialValue,
  title,
  desc,
  question,
  onSubmit,
}) => {
  // Create a form with Mantine's useForm hook
  const form = useForm({
    initialValues: {
      answer: "",
    },

    validate: {
      answer: (value: string) =>
        value.trim().length === 0 ? "You must provide an answer" : null,
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
            type="submit"
            onClick={() => onSubmit(null)}
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
