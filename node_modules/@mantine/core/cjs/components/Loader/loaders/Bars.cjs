'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var cx = require('clsx');
require('@mantine/hooks');
require('../../../core/MantineProvider/Mantine.context.cjs');
require('../../../core/MantineProvider/default-theme.cjs');
require('../../../core/MantineProvider/MantineProvider.cjs');
require('../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var Box = require('../../../core/Box/Box.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');
var Loader_module = require('../Loader.module.css.cjs');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var cx__default = /*#__PURE__*/_interopDefault(cx);

const Bars = React.forwardRef(({ className, ...others }, ref) => /* @__PURE__ */ jsxRuntime.jsxs(Box.Box, { component: "span", className: cx__default.default(Loader_module.barsLoader, className), ...others, ref, children: [
  /* @__PURE__ */ jsxRuntime.jsx("span", { className: Loader_module.bar }),
  /* @__PURE__ */ jsxRuntime.jsx("span", { className: Loader_module.bar }),
  /* @__PURE__ */ jsxRuntime.jsx("span", { className: Loader_module.bar })
] }));
Bars.displayName = "@mantine/core/Bars";

exports.Bars = Bars;
//# sourceMappingURL=Bars.cjs.map
