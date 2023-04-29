import useStore from './store';
import { EditText } from 'react-edit-text';
import 'react-edit-text/dist/index.css';

export default function NodeLabel({ title, nodeId, onEdit, onSave }) {
    const setDataPropsForNode = useStore((state) => state.setDataPropsForNode);

    const handleNodeLabelChange = (evt) => {
        const { value } = evt;
        title = value;
        setDataPropsForNode(nodeId, { title: value });
        if (onSave) onSave();
    }
    const handleEnterEditMode = () => {
        if (onEdit) onEdit();
    };

    return (
        <EditText className="nodrag" name={nodeId ? nodeId+"-label" : "node-label"}
                  defaultValue={title || 'Node'} 
                  style={{width: '80%', margin:'0px', padding:'0px', minHeight:'18px'}} 
                  onEditMode={handleEnterEditMode} 
                  onSave={handleNodeLabelChange}
                  inline={true} 
        />
    );
}