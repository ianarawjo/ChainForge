'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
require('react');
require('@mantine/hooks');
require('clsx');
var Mantine_context = require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
require('../../core/Box/Box.cjs');
var factory = require('../../core/factory/factory.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
var Portal = require('./Portal.cjs');

const OptionalPortal = factory.factory(
  ({ withinPortal = true, children, ...others }, ref) => {
    const env = Mantine_context.useMantineEnv();
    if (env === "test" || !withinPortal) {
      return /* @__PURE__ */ jsxRuntime.jsx(jsxRuntime.Fragment, { children });
    }
    return /* @__PURE__ */ jsxRuntime.jsx(Portal.Portal, { ref, ...others, children });
  }
);
OptionalPortal.displayName = "@mantine/core/OptionalPortal";

exports.OptionalPortal = OptionalPortal;
//# sourceMappingURL=OptionalPortal.cjs.map
