'use client';
import { jsx, Fragment } from 'react/jsx-runtime';
import 'react';
import '@mantine/hooks';
import 'clsx';
import { useMantineEnv } from '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../core/Box/Box.mjs';
import { factory } from '../../core/factory/factory.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import { Portal } from './Portal.mjs';

const OptionalPortal = factory(
  ({ withinPortal = true, children, ...others }, ref) => {
    const env = useMantineEnv();
    if (env === "test" || !withinPortal) {
      return /* @__PURE__ */ jsx(Fragment, { children });
    }
    return /* @__PURE__ */ jsx(Portal, { ref, ...others, children });
  }
);
OptionalPortal.displayName = "@mantine/core/OptionalPortal";

export { OptionalPortal };
//# sourceMappingURL=OptionalPortal.mjs.map
