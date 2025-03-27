'use client';
'use strict';

var transitions = require('../transitions.cjs');

const transitionStatuses = {
  entering: "in",
  entered: "in",
  exiting: "out",
  exited: "out",
  "pre-exiting": "out",
  "pre-entering": "out"
};
function getTransitionStyles({
  transition,
  state,
  duration,
  timingFunction
}) {
  const shared = {
    WebkitBackfaceVisibility: "hidden",
    willChange: "transform, opacity",
    transitionDuration: `${duration}ms`,
    transitionTimingFunction: timingFunction
  };
  if (typeof transition === "string") {
    if (!(transition in transitions.transitions)) {
      return {};
    }
    return {
      transitionProperty: transitions.transitions[transition].transitionProperty,
      ...shared,
      ...transitions.transitions[transition].common,
      ...transitions.transitions[transition][transitionStatuses[state]]
    };
  }
  return {
    transitionProperty: transition.transitionProperty,
    ...shared,
    ...transition.common,
    ...transition[transitionStatuses[state]]
  };
}

exports.getTransitionStyles = getTransitionStyles;
//# sourceMappingURL=get-transition-styles.cjs.map
