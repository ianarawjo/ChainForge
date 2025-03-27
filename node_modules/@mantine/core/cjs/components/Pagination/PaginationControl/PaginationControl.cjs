'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
require('react');
require('@mantine/hooks');
require('clsx');
require('../../../core/MantineProvider/Mantine.context.cjs');
require('../../../core/MantineProvider/default-theme.cjs');
require('../../../core/MantineProvider/MantineProvider.cjs');
require('../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../../core/MantineProvider/use-props/use-props.cjs');
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
require('../../../core/Box/Box.cjs');
var factory = require('../../../core/factory/factory.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');
var UnstyledButton = require('../../UnstyledButton/UnstyledButton.cjs');
var Pagination_context = require('../Pagination.context.cjs');
var Pagination_module = require('../Pagination.module.css.cjs');

const defaultProps = {
  withPadding: true
};
const PaginationControl = factory.factory((_props, ref) => {
  const props = useProps.useProps("PaginationControl", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    vars,
    active,
    disabled,
    withPadding,
    mod,
    ...others
  } = props;
  const ctx = Pagination_context.usePaginationContext();
  const _disabled = disabled || ctx.disabled;
  return /* @__PURE__ */ jsxRuntime.jsx(
    UnstyledButton.UnstyledButton,
    {
      ref,
      disabled: _disabled,
      mod: [{ active, disabled: _disabled, "with-padding": withPadding }, mod],
      ...ctx.getStyles("control", { className, style, classNames, styles, active: !_disabled }),
      ...others
    }
  );
});
PaginationControl.classes = Pagination_module;
PaginationControl.displayName = "@mantine/core/PaginationControl";

exports.PaginationControl = PaginationControl;
//# sourceMappingURL=PaginationControl.cjs.map
