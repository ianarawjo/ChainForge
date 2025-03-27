'use client';
import { jsx } from 'react/jsx-runtime';
import 'react';
import '@mantine/hooks';
import 'clsx';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../core/MantineProvider/use-props/use-props.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { Box } from '../../core/Box/Box.mjs';
import { factory } from '../../core/factory/factory.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';

const defaultProps = {};
const Space = factory((props, ref) => {
  const { w, h, miw, mih, ...others } = useProps("Space", defaultProps, props);
  return /* @__PURE__ */ jsx(Box, { ref, ...others, w, miw: miw ?? w, h, mih: mih ?? h });
});
Space.displayName = "@mantine/core/Space";

export { Space };
//# sourceMappingURL=Space.mjs.map
