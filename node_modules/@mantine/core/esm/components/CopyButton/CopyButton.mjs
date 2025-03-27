'use client';
import { jsx, Fragment } from 'react/jsx-runtime';
import { useClipboard } from '@mantine/hooks';
import 'react';
import 'clsx';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../core/MantineProvider/use-props/use-props.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../core/Box/Box.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';

const defaultProps = {
  timeout: 1e3
};
function CopyButton(props) {
  const { children, timeout, value, ...others } = useProps("CopyButton", defaultProps, props);
  const clipboard = useClipboard({ timeout });
  const copy = () => clipboard.copy(value);
  return /* @__PURE__ */ jsx(Fragment, { children: children({ copy, copied: clipboard.copied, ...others }) });
}
CopyButton.displayName = "@mantine/core/CopyButton";

export { CopyButton };
//# sourceMappingURL=CopyButton.mjs.map
