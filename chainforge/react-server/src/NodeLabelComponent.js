import { useRef } from 'react';
import useStore from './store';
import { EditText } from 'react-edit-text';
import 'react-edit-text/dist/index.css';
import StatusIndicator from './StatusIndicatorComponent';
import AlertModal from './AlertModal';
import AreYouSureModal from './AreYouSureModal';
import { useState, useEffect, useCallback} from 'react';
import { Tooltip, Popover, Badge, Stack } from '@mantine/core';
import { IconSparkles } from '@tabler/icons-react';


export default function NodeLabel({ title, nodeId, icon, onEdit, onSave, editable, status, alertModal, customButtons, handleRunClick, handleRunHover, runButtonTooltip }) {
    const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);
    const [statusIndicator, setStatusIndicator] = useState('none');
    const [runButton, setRunButton] = useState('none');
    const removeNode = useStore((state) => state.removeNode);

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

    return (<>
        <div className="node-header drag-handle">
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
    </>);
}