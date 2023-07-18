export default function StatusIndicator({ status }) {
  switch (status) {
    case 'warning':  // Display mustard 'warning' icon
        return (
            <div className="status-icon warning-status">&#9888;<span className='status-tooltip'>Something changed. Downstream results might be invalidated. Press Play to rerun.</span></div>
        );
    case 'ready':  // Display green checkmark 'ready' icon
        return (
            <div className="status-icon ready-status">&#10004;<span className='status-tooltip'>Responses collected and ready.</span></div>
        );
    case 'error':  // Display red 'error' icon
        return ( 
            <div className="status-icon error-status">&#10006;<span className='status-tooltip'>Error collecting responses.</span></div>
        );
    case 'loading':  // Display animated 'loading' spinner icon 
        return (
            <div className="lds-ring"><div></div><div></div><div></div><div></div></div>
        );
    default:
        return [];
  }
}