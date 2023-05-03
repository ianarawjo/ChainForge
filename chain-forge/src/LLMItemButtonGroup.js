import { useDisclosure } from '@mantine/hooks';
import { Modal, Button, Group } from '@mantine/core';
import { IconSettings, IconTrash } from '@tabler/icons-react';

export default function LLMItemButtonGroup( {onClickTrash, onClickSettings} ) {
    const [opened, { open, close }] = useDisclosure(false);

    return (
    <div>
        <Modal opened={opened} onClose={close} title="Authentication">
            {/* Modal content */}
        </Modal>

        <Group position="right" style={{float: 'right', height:'20px'}}>
        <Button onClick={onClickTrash} size="xs" variant="light" compact color="red" style={{padding: '0px'}} ><IconTrash size={"95%"} /></Button>
            <Button onClick={onClickSettings} size="xs" variant="light" compact>Settings&nbsp;<IconSettings size={"110%"} /></Button>
        </Group>
    </div>
    );
}