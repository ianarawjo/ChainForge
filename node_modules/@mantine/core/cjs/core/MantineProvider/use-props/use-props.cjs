'use client';
'use strict';

var filterProps = require('../../utils/filter-props/filter-props.cjs');
require('react');
require('react/jsx-runtime');
require('@mantine/hooks');
var MantineThemeProvider = require('../MantineThemeProvider/MantineThemeProvider.cjs');

function useProps(component, defaultProps, props) {
  const theme = MantineThemeProvider.useMantineTheme();
  const contextPropsPayload = theme.components[component]?.defaultProps;
  const contextProps = typeof contextPropsPayload === "function" ? contextPropsPayload(theme) : contextPropsPayload;
  return { ...defaultProps, ...contextProps, ...filterProps.filterProps(props) };
}

exports.useProps = useProps;
//# sourceMappingURL=use-props.cjs.map
