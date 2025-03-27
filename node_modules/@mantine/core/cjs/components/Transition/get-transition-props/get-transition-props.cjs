'use client';
'use strict';

const defaultTransition = {
  duration: 100,
  transition: "fade"
};
function getTransitionProps(transitionProps, componentTransition) {
  return { ...defaultTransition, ...componentTransition, ...transitionProps };
}

exports.getTransitionProps = getTransitionProps;
//# sourceMappingURL=get-transition-props.cjs.map
