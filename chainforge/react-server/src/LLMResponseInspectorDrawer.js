import LLMResponseInspector from "./LLMResponseInspector";

const LLMResponseInspectorDrawer = ({jsonResponses, showDrawer}) => {
  return (
    <div className='inspect-responses-drawer' style={{display: showDrawer ? 'initial' : 'none'}}>
      <div className='inspect-response-container nowheel nodrag' style={{margin: '0px 10px 10px 12px'}}>
          <LLMResponseInspector jsonResponses={jsonResponses} />
      </div>
    </div>
  );
};

export default LLMResponseInspectorDrawer;