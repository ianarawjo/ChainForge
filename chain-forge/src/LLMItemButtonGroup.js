import { useDisclosure } from '@mantine/hooks';
import { Modal, Button, Group, RingProgress } from '@mantine/core';
import { IconSettings, IconTrash } from '@tabler/icons-react';

export default function LLMItemButtonGroup( {onClickTrash, onClickSettings, ringProgress} ) {
    const [opened, { open, close }] = useDisclosure(false);

    return (
    <div>
        <Modal opened={opened} onClose={close} title="Authentication">
            {/* Modal content */}
        </Modal>

        <Group position="right" style={{float: 'right', height:'20px'}}>
            {ringProgress !== undefined ? 
                (ringProgress > 0 ?
                    (<RingProgress size={20} thickness={3} sections={[{ value: ringProgress, color: ringProgress < 99 ? 'blue' : 'green' }]} width='16px' />) :
                    (<div className="lds-ring"><div></div><div></div><div></div><div></div></div>))
                : (<></>)
            }
            <Button onClick={onClickTrash} size="xs" variant="light" compact color="red" style={{padding: '0px'}} ><IconTrash size={"95%"} /></Button>
            {/* <Button onClick={onClickSettings} size="xs" variant="light" compact>Settings&nbsp;<IconSettings size={"110%"} /></Button> */}
        </Group>
    </div>
    );
}