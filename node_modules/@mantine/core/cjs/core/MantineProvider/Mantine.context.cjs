'use client';
'use strict';

var React = require('react');

const MantineContext = React.createContext(null);
function useMantineContext() {
  const ctx = React.useContext(MantineContext);
  if (!ctx) {
    throw new Error("[@mantine/core] MantineProvider was not found in tree");
  }
  return ctx;
}
function useMantineCssVariablesResolver() {
  return useMantineContext().cssVariablesResolver;
}
function useMantineClassNamesPrefix() {
  return useMantineContext().classNamesPrefix;
}
function useMantineStyleNonce() {
  return useMantineContext().getStyleNonce;
}
function useMantineWithStaticClasses() {
  return useMantineContext().withStaticClasses;
}
function useMantineIsHeadless() {
  return useMantineContext().headless;
}
function useMantineSxTransform() {
  return useMantineContext().stylesTransform?.sx;
}
function useMantineStylesTransform() {
  return useMantineContext().stylesTransform?.styles;
}
function useMantineEnv() {
  return useMantineContext().env || "default";
}

exports.MantineContext = MantineContext;
exports.useMantineClassNamesPrefix = useMantineClassNamesPrefix;
exports.useMantineContext = useMantineContext;
exports.useMantineCssVariablesResolver = useMantineCssVariablesResolver;
exports.useMantineEnv = useMantineEnv;
exports.useMantineIsHeadless = useMantineIsHeadless;
exports.useMantineStyleNonce = useMantineStyleNonce;
exports.useMantineStylesTransform = useMantineStylesTransform;
exports.useMantineSxTransform = useMantineSxTransform;
exports.useMantineWithStaticClasses = useMantineWithStaticClasses;
//# sourceMappingURL=Mantine.context.cjs.map
