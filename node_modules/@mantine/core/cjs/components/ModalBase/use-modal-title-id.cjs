'use client';
'use strict';

var React = require('react');
var ModalBase_context = require('./ModalBase.context.cjs');

function useModalTitle() {
  const ctx = ModalBase_context.useModalBaseContext();
  React.useEffect(() => {
    ctx.setTitleMounted(true);
    return () => ctx.setTitleMounted(false);
  }, []);
  return ctx.getTitleId();
}

exports.useModalTitle = useModalTitle;
//# sourceMappingURL=use-modal-title-id.cjs.map
