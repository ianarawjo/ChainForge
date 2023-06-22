import React, { forwardRef, useImperativeHandle } from 'react';
import { Modal, Button, Box, Text, Flex } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';

/** Modal that lets user rename a single value, using a TextInput field. */
const AreYouSureModal = forwardRef(({title, message, onConfirm}, ref) => {
  const [opened, { open, close }] = useDisclosure(false);
  const description = message ? message : 'Are you sure?';

  // This gives the parent access to triggering the modal alert
  const trigger = () => {
    open();
  };
  useImperativeHandle(ref, () => ({
    trigger,
  }));

  const confirmAndClose = () => {
    close();
    if (onConfirm) onConfirm();
  }

  return (
    <Modal opened={opened} onClose={close} title={title} styles={{header: {backgroundColor: 'red', color: 'white'}, root: {position: 'relative', left: '-80px'}}}>
      <Box maw={400} mx="auto" mt='md' mb='md'>
        <Text>{description}</Text>
      </Box>
      <Flex mih={50}
              gap="md"
              justify="space-evenly"
              align="center"
              direction="row"
              wrap="wrap"
            >
          <Button variant='light' color='red' type="submit" w='40%' onClick={close}>Cancel</Button>
          <Button variant='filled' color='green' type="submit" w='40%' onClick={confirmAndClose}>Confirm</Button>
        </Flex>
    </Modal>
  );
});

export default AreYouSureModal;