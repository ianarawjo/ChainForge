'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var cx = require('clsx');
require('react');
require('@mantine/hooks');
require('../../../core/MantineProvider/Mantine.context.cjs');
require('../../../core/MantineProvider/default-theme.cjs');
require('../../../core/MantineProvider/MantineProvider.cjs');
require('../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../../core/MantineProvider/use-props/use-props.cjs');
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var useRandomClassname = require('../../../core/Box/use-random-classname/use-random-classname.cjs');
var Box = require('../../../core/Box/Box.cjs');
var factory = require('../../../core/factory/factory.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');
var Grid_context = require('../Grid.context.cjs');
var GridColVariables = require('./GridColVariables.cjs');
var Grid_module = require('../Grid.module.css.cjs');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var cx__default = /*#__PURE__*/_interopDefault(cx);

const defaultProps = {
  span: 12
};
const GridCol = factory.factory((_props, ref) => {
  const props = useProps.useProps("GridCol", defaultProps, _props);
  const { classNames, className, style, styles, vars, span, order, offset, ...others } = props;
  const ctx = Grid_context.useGridContext();
  const responsiveClassName = useRandomClassname.useRandomClassName();
  return /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsx(
      GridColVariables.GridColVariables,
      {
        selector: `.${responsiveClassName}`,
        span,
        order,
        offset
      }
    ),
    /* @__PURE__ */ jsxRuntime.jsx(
      Box.Box,
      {
        ref,
        ...ctx.getStyles("col", {
          className: cx__default.default(className, responsiveClassName),
          style,
          classNames,
          styles
        }),
        ...others
      }
    )
  ] });
});
GridCol.classes = Grid_module;
GridCol.displayName = "@mantine/core/GridCol";

exports.GridCol = GridCol;
//# sourceMappingURL=GridCol.cjs.map
