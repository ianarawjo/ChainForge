'use client';
'use strict';

var ModalBase_context = require('./ModalBase.context.cjs');

const DEFAULT_TRANSITION = {
  duration: 200,
  timingFunction: "ease",
  transition: "fade"
};
function useModalTransition(transitionOverride) {
  const ctx = ModalBase_context.useModalBaseContext();
  return { ...DEFAULT_TRANSITION, ...ctx.transitionProps, ...transitionOverride };
}

exports.useModalTransition = useModalTransition;
//# sourceMappingURL=use-modal-transition.cjs.map
