'use client';
import { createContext, useContext } from 'react';

const MantineContext = createContext(null);
function useMantineContext() {
  const ctx = useContext(MantineContext);
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

export { MantineContext, useMantineClassNamesPrefix, useMantineContext, useMantineCssVariablesResolver, useMantineEnv, useMantineIsHeadless, useMantineStyleNonce, useMantineStylesTransform, useMantineSxTransform, useMantineWithStaticClasses };
//# sourceMappingURL=Mantine.context.mjs.map
