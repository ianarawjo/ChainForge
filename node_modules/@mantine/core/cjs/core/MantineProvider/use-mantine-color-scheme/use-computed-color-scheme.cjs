'use client';
'use strict';

var hooks = require('@mantine/hooks');
var useMantineColorScheme = require('./use-mantine-color-scheme.cjs');

function useComputedColorScheme(defaultValue, options = { getInitialValueInEffect: true }) {
  const osColorScheme = hooks.useColorScheme(defaultValue, options);
  const { colorScheme } = useMantineColorScheme.useMantineColorScheme();
  return colorScheme === "auto" ? osColorScheme : colorScheme;
}

exports.useComputedColorScheme = useComputedColorScheme;
//# sourceMappingURL=use-computed-color-scheme.cjs.map
