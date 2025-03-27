'use client';
'use strict';

var React = require('react');
var hooks = require('@mantine/hooks');
require('react/jsx-runtime');
var getEnv = require('../../core/utils/get-env/get-env.cjs');
require('clsx');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
require('../../core/Box/Box.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
var toInt = require('../ScrollArea/utils/to-int.cjs');

function isParent(parentElement, childElement) {
  if (!childElement || !parentElement) {
    return false;
  }
  let parent = childElement.parentNode;
  while (parent != null) {
    if (parent === parentElement) {
      return true;
    }
    parent = parent.parentNode;
  }
  return false;
}
function useFloatingIndicator({
  target,
  parent,
  ref,
  displayAfterTransitionEnd
}) {
  const transitionTimeout = React.useRef(-1);
  const [initialized, setInitialized] = React.useState(false);
  const [hidden, setHidden] = React.useState(
    typeof displayAfterTransitionEnd === "boolean" ? displayAfterTransitionEnd : false
  );
  const updatePosition = () => {
    if (!target || !parent || !ref.current) {
      return;
    }
    const targetRect = target.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    const targetComputedStyle = window.getComputedStyle(target);
    const parentComputedStyle = window.getComputedStyle(parent);
    const borderTopWidth = toInt.toInt(targetComputedStyle.borderTopWidth) + toInt.toInt(parentComputedStyle.borderTopWidth);
    const borderLeftWidth = toInt.toInt(targetComputedStyle.borderLeftWidth) + toInt.toInt(parentComputedStyle.borderLeftWidth);
    const position = {
      top: targetRect.top - parentRect.top - borderTopWidth,
      left: targetRect.left - parentRect.left - borderLeftWidth,
      width: targetRect.width,
      height: targetRect.height
    };
    ref.current.style.transform = `translateY(${position.top}px) translateX(${position.left}px)`;
    ref.current.style.width = `${position.width}px`;
    ref.current.style.height = `${position.height}px`;
  };
  const updatePositionWithoutAnimation = () => {
    window.clearTimeout(transitionTimeout.current);
    if (ref.current) {
      ref.current.style.transitionDuration = "0ms";
    }
    updatePosition();
    transitionTimeout.current = window.setTimeout(() => {
      if (ref.current) {
        ref.current.style.transitionDuration = "";
      }
    }, 30);
  };
  const targetResizeObserver = React.useRef(null);
  const parentResizeObserver = React.useRef(null);
  React.useEffect(() => {
    updatePosition();
    if (target) {
      targetResizeObserver.current = new ResizeObserver(updatePositionWithoutAnimation);
      targetResizeObserver.current.observe(target);
      if (parent) {
        parentResizeObserver.current = new ResizeObserver(updatePositionWithoutAnimation);
        parentResizeObserver.current.observe(parent);
      }
      return () => {
        targetResizeObserver.current?.disconnect();
        parentResizeObserver.current?.disconnect();
      };
    }
    return void 0;
  }, [parent, target]);
  React.useEffect(() => {
    if (parent) {
      const handleTransitionEnd = (event) => {
        if (isParent(event.target, parent)) {
          updatePositionWithoutAnimation();
          setHidden(false);
        }
      };
      parent.addEventListener("transitionend", handleTransitionEnd);
      return () => {
        parent.removeEventListener("transitionend", handleTransitionEnd);
      };
    }
    return void 0;
  }, [parent]);
  hooks.useTimeout(
    () => {
      if (getEnv.getEnv() !== "test") {
        setInitialized(true);
      }
    },
    20,
    { autoInvoke: true }
  );
  hooks.useMutationObserver(
    (mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes" && mutation.attributeName === "dir") {
          updatePositionWithoutAnimation();
        }
      });
    },
    { attributes: true, attributeFilter: ["dir"] },
    () => document.documentElement
  );
  return { initialized, hidden };
}

exports.useFloatingIndicator = useFloatingIndicator;
//# sourceMappingURL=use-floating-indicator.cjs.map
