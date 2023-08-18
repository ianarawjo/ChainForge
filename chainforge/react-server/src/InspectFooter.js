import { useState } from "react";
import { Button } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";

/**
 * The footer at the bottom of a node, allowing a user to click it 
 * to inspect responses. 
 */
const InspectFooter = ({ label, onClick, showNotificationDot }) => {
  const [text, setText] = useState(label || (<>Inspect responses&nbsp;<IconSearch size='12pt' /></>));

  return (
    <div className="eval-inspect-response-footer nodrag" onClick={onClick} style={{display: 'flex', justifyContent:'center'}}>
      <Button color='blue' variant='subtle' w='100%' >
        {text}
        { showNotificationDot ? <div className="something-changed-circle"></div> : <></>}
      </Button>
    </div>
  );
};

export default InspectFooter;