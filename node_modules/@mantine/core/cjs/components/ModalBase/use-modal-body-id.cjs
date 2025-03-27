'use client';
'use strict';

var React = require('react');
var ModalBase_context = require('./ModalBase.context.cjs');

function useModalBodyId() {
  const ctx = ModalBase_context.useModalBaseContext();
  React.useEffect(() => {
    ctx.setBodyMounted(true);
    return () => ctx.setBodyMounted(false);
  }, []);
  return ctx.getBodyId();
}

exports.useModalBodyId = useModalBodyId;
//# sourceMappingURL=use-modal-body-id.cjs.map
