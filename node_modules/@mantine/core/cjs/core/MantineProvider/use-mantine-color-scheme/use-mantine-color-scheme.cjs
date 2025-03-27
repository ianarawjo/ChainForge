'use client';
'use strict';

var React = require('react');
var hooks = require('@mantine/hooks');
require('react/jsx-runtime');
var noop = require('../../utils/noop/noop.cjs');
var Mantine_context = require('../Mantine.context.cjs');

function disableTransition(nonce) {
  const style = document.createElement("style");
  style.setAttribute("data-mantine-styles", "inline");
  style.innerHTML = "*, *::before, *::after {transition: none !important;}";
  style.setAttribute("data-mantine-disable-transition", "true");
  nonce && style.setAttribute("nonce", nonce);
  document.head.appendChild(style);
  const clear = () => document.querySelectorAll("[data-mantine-disable-transition]").forEach((element) => element.remove());
  return clear;
}
function useMantineColorScheme({ keepTransitions } = {}) {
  const clearStylesRef = React.useRef(noop.noop);
  const timeoutRef = React.useRef(-1);
  const ctx = React.useContext(Mantine_context.MantineContext);
  const nonce = Mantine_context.useMantineStyleNonce();
  const nonceValue = React.useRef(nonce?.());
  if (!ctx) {
    throw new Error("[@mantine/core] MantineProvider was not found in tree");
  }
  const setColorScheme = (value) => {
    ctx.setColorScheme(value);
    clearStylesRef.current = keepTransitions ? () => {
    } : disableTransition(nonceValue.current);
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      clearStylesRef.current?.();
    }, 10);
  };
  const clearColorScheme = () => {
    ctx.clearColorScheme();
    clearStylesRef.current = keepTransitions ? () => {
    } : disableTransition(nonceValue.current);
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      clearStylesRef.current?.();
    }, 10);
  };
  const osColorScheme = hooks.useColorScheme("light", { getInitialValueInEffect: false });
  const computedColorScheme = ctx.colorScheme === "auto" ? osColorScheme : ctx.colorScheme;
  const toggleColorScheme = React.useCallback(
    () => setColorScheme(computedColorScheme === "light" ? "dark" : "light"),
    [setColorScheme, computedColorScheme]
  );
  React.useEffect(
    () => () => {
      clearStylesRef.current?.();
      window.clearTimeout(timeoutRef.current);
    },
    []
  );
  return {
    colorScheme: ctx.colorScheme,
    setColorScheme,
    clearColorScheme,
    toggleColorScheme
  };
}

exports.useMantineColorScheme = useMantineColorScheme;
//# sourceMappingURL=use-mantine-color-scheme.cjs.map
