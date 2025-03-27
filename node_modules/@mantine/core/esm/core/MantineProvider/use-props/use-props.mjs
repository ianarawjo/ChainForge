'use client';
import { filterProps } from '../../utils/filter-props/filter-props.mjs';
import 'react';
import 'react/jsx-runtime';
import '@mantine/hooks';
import { useMantineTheme } from '../MantineThemeProvider/MantineThemeProvider.mjs';

function useProps(component, defaultProps, props) {
  const theme = useMantineTheme();
  const contextPropsPayload = theme.components[component]?.defaultProps;
  const contextProps = typeof contextPropsPayload === "function" ? contextPropsPayload(theme) : contextPropsPayload;
  return { ...defaultProps, ...contextProps, ...filterProps(props) };
}

export { useProps };
//# sourceMappingURL=use-props.mjs.map
