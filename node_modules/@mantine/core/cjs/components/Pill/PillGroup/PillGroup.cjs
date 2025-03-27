'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
require('react');
var getSize = require('../../../core/utils/get-size/get-size.cjs');
require('@mantine/hooks');
var createVarsResolver = require('../../../core/styles-api/create-vars-resolver/create-vars-resolver.cjs');
require('clsx');
require('../../../core/MantineProvider/Mantine.context.cjs');
require('../../../core/MantineProvider/default-theme.cjs');
require('../../../core/MantineProvider/MantineProvider.cjs');
require('../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../../core/MantineProvider/use-props/use-props.cjs');
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var useStyles = require('../../../core/styles-api/use-styles/use-styles.cjs');
var Box = require('../../../core/Box/Box.cjs');
var factory = require('../../../core/factory/factory.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');
var PillsInput_context = require('../../PillsInput/PillsInput.context.cjs');
var PillGroup_context = require('../PillGroup.context.cjs');
var Pill_module = require('../Pill.module.css.cjs');

const defaultProps = {};
const varsResolver = createVarsResolver.createVarsResolver((_, { gap }, { size }) => ({
  group: {
    "--pg-gap": gap !== void 0 ? getSize.getSize(gap) : getSize.getSize(size, "pg-gap")
  }
}));
const PillGroup = factory.factory((_props, ref) => {
  const props = useProps.useProps("PillGroup", defaultProps, _props);
  const { classNames, className, style, styles, unstyled, vars, size, disabled, ...others } = props;
  const pillsInputCtx = PillsInput_context.usePillsInputContext();
  const _size = pillsInputCtx?.size || size || void 0;
  const getStyles = useStyles.useStyles({
    name: "PillGroup",
    classes: Pill_module,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver,
    stylesCtx: { size: _size },
    rootSelector: "group"
  });
  return /* @__PURE__ */ jsxRuntime.jsx(PillGroup_context.PillGroupProvider, { value: { size: _size, disabled }, children: /* @__PURE__ */ jsxRuntime.jsx(Box.Box, { ref, size: _size, ...getStyles("group"), ...others }) });
});
PillGroup.classes = Pill_module;
PillGroup.displayName = "@mantine/core/PillGroup";

exports.PillGroup = PillGroup;
//# sourceMappingURL=PillGroup.cjs.map
