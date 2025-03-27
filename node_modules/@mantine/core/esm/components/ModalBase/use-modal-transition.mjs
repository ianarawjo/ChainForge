'use client';
import { useModalBaseContext } from './ModalBase.context.mjs';

const DEFAULT_TRANSITION = {
  duration: 200,
  timingFunction: "ease",
  transition: "fade"
};
function useModalTransition(transitionOverride) {
  const ctx = useModalBaseContext();
  return { ...DEFAULT_TRANSITION, ...ctx.transitionProps, ...transitionOverride };
}

export { useModalTransition };
//# sourceMappingURL=use-modal-transition.mjs.map
