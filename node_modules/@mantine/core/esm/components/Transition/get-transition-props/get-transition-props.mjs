'use client';
const defaultTransition = {
  duration: 100,
  transition: "fade"
};
function getTransitionProps(transitionProps, componentTransition) {
  return { ...defaultTransition, ...componentTransition, ...transitionProps };
}

export { getTransitionProps };
//# sourceMappingURL=get-transition-props.mjs.map
