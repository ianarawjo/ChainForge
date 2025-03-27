'use client';
import { useRef, useState, useEffect } from 'react';
import { useTimeout, useMutationObserver } from '@mantine/hooks';
import 'react/jsx-runtime';
import { getEnv } from '../../core/utils/get-env/get-env.mjs';
import 'clsx';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../core/Box/Box.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import { toInt } from '../ScrollArea/utils/to-int.mjs';

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
  const transitionTimeout = useRef(-1);
  const [initialized, setInitialized] = useState(false);
  const [hidden, setHidden] = useState(
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
    const borderTopWidth = toInt(targetComputedStyle.borderTopWidth) + toInt(parentComputedStyle.borderTopWidth);
    const borderLeftWidth = toInt(targetComputedStyle.borderLeftWidth) + toInt(parentComputedStyle.borderLeftWidth);
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
  const targetResizeObserver = useRef(null);
  const parentResizeObserver = useRef(null);
  useEffect(() => {
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
  useEffect(() => {
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
  useTimeout(
    () => {
      if (getEnv() !== "test") {
        setInitialized(true);
      }
    },
    20,
    { autoInvoke: true }
  );
  useMutationObserver(
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

export { useFloatingIndicator };
//# sourceMappingURL=use-floating-indicator.mjs.map
