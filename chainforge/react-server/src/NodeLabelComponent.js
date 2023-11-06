import { useRef } from 'react';
import useStore from './store';
import { EditText } from 'react-edit-text';
import 'react-edit-text/dist/index.css';
import StatusIndicator from './StatusIndicatorComponent';
import AlertModal from './AlertModal';
import AreYouSureModal from './AreYouSureModal';
import { useState, useEffect, useCallback} from 'react';
import { Tooltip, Menu } from '@mantine/core';
import { IconCopy, IconX } from '@tabler/icons-react';

export default function NodeLabel({ title, nodeId, icon, onEdit, onSave, editable, status, alertModal, customButtons, handleRunClick, handleRunHover, runButtonTooltip }) {
    const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
    const [statusIndicator, setStatusIndicator] = useState('none');
    const [runButton, setRunButton] = useState('none');
    const removeNode = useStore((state) => state.removeNode);
    const duplicateNode = useStore((state) => state.duplicateNode);

    const [contextMenuPos, setContextMenuPos] = useState({left: -100, top:0});
    const [contextMenuOpened, setContextMenuOpened] = useState(false);

    // For 'delete node' confirmation popup
    const deleteConfirmModal = useRef(null);
    const [deleteConfirmProps, setDeleteConfirmProps] = useState({
        title: 'Delete node', message: 'Are you sure?', onConfirm: () => {}
    });

    const handleNodeLabelChange = (evt) => {
        const { value } = evt;
        title = value;
        setDataPropsForNode(nodeId, { title: value });
        if (onSave) onSave();
    }
    const handleEnterEditMode = () => {
        if (onEdit) onEdit();
    };

    useEffect(() => {
        if(status !== undefined) {
            setStatusIndicator(<StatusIndicator status={status} />);
        }
        else {
            setStatusIndicator(<></>);
        }
    }, [status]);

    useEffect(() => {
        if(handleRunClick !== undefined) {
            const run_btn = (<button className="AmitSahoo45-button-3 nodrag" onClick={handleRunClick} onPointerEnter={handleRunHover}>&#9654;</button>);
            if (runButtonTooltip)
                setRunButton(
                    <Tooltip label={runButtonTooltip} withArrow arrowSize={6} arrowRadius={2} zIndex={1001} withinPortal={true} >
                    {run_btn}
                    </Tooltip>
                );
            else
                setRunButton(run_btn);
        }
        else {
            setRunButton(<></>);
        }
    }, [handleRunClick, runButtonTooltip]);

    const handleCloseButtonClick = useCallback(() => {
        setDeleteConfirmProps({
            title: 'Delete node',
            message: 'Are you sure you want to delete this node? This action is irreversible.',
            onConfirm: () => removeNode(nodeId), 
        });
      
        // Open the 'are you sure' modal:
        if (deleteConfirmModal && deleteConfirmModal.current)
            deleteConfirmModal.current.trigger();
    }, [deleteConfirmModal]);

    const handleDuplicateNode = useCallback(() => {
        duplicateNode(nodeId, { x: 28, y: 28 });
    }, [nodeId, duplicateNode]);

    const handleOpenContextMenu = (e) => {
        e.preventDefault();
        setContextMenuPos({
            left: e.pageX,
            top: e.pageY
        });
        setContextMenuOpened(true);
    };

    return (<>
    <Menu opened={contextMenuOpened} withinPortal={true} onChange={setContextMenuOpened} styles={{
        dropdown: {
          position: 'absolute',
          left: contextMenuPos.left + 'px !important',
          top: contextMenuPos.top + 'px !important',
          boxShadow: '2px 2px 4px #ccc',
    }}}>
        <div className="node-header drag-handle" onPointerDown={() => setContextMenuOpened(false)} onContextMenu={handleOpenContextMenu}>
            {icon ? (<>{icon}&nbsp;</>) : <></>}
            <AreYouSureModal ref={deleteConfirmModal} title={deleteConfirmProps.title} message={deleteConfirmProps.message} onConfirm={deleteConfirmProps.onConfirm} />
            <EditText className="nodrag" name={nodeId ? nodeId + "-label" : "node-label"}
                defaultValue={title || 'Node'}
                style={{ width: '60%', margin: '0px', padding: '0px', minHeight: '18px' }}
                onEditMode={handleEnterEditMode}
                onSave={handleNodeLabelChange}
                inline={true}
                readonly={editable !== undefined ? (!editable) : false}
            />
            {statusIndicator}
            <AlertModal ref={alertModal} />
            <div className="node-header-btns-container">
                {customButtons ? customButtons : <></>}
                {runButton}
                <button className="close-button nodrag" onClick={handleCloseButtonClick}>&#x2715;</button>
                <br/>
            </div>
            {/* <button className="AmitSahoo45-button-3 nodrag" onClick={handleRunClick}><div className="play-button"></div></button> */}
        </div>
        <Menu.Dropdown>
            <Menu.Item key='duplicate' onClick={handleDuplicateNode}><IconCopy size='10pt' />&nbsp;Duplicate Node</Menu.Item>
            <Menu.Item key='delete' onClick={handleCloseButtonClick}><IconX size='10pt' />&nbsp;Delete Node</Menu.Item>
        </Menu.Dropdown>
    </Menu>
    </>);
}