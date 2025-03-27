'use client';
import { useColorScheme } from '@mantine/hooks';
import { useMantineColorScheme } from './use-mantine-color-scheme.mjs';

function useComputedColorScheme(defaultValue, options = { getInitialValueInEffect: true }) {
  const osColorScheme = useColorScheme(defaultValue, options);
  const { colorScheme } = useMantineColorScheme();
  return colorScheme === "auto" ? osColorScheme : colorScheme;
}

export { useComputedColorScheme };
//# sourceMappingURL=use-computed-color-scheme.mjs.map
