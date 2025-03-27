'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
require('react');
var getSize = require('../../core/utils/get-size/get-size.cjs');
require('@mantine/hooks');
var createVarsResolver = require('../../core/styles-api/create-vars-resolver/create-vars-resolver.cjs');
require('clsx');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../core/MantineProvider/use-props/use-props.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var useStyles = require('../../core/styles-api/use-styles/use-styles.cjs');
var Box = require('../../core/Box/Box.cjs');
var factory = require('../../core/factory/factory.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
require('../CloseButton/CloseIcon.cjs');
var CloseButton = require('../CloseButton/CloseButton.cjs');
var PillsInput_context = require('../PillsInput/PillsInput.context.cjs');
var PillGroup_context = require('./PillGroup.context.cjs');
var PillGroup = require('./PillGroup/PillGroup.cjs');
var Pill_module = require('./Pill.module.css.cjs');

const defaultProps = {
  variant: "default"
};
const varsResolver = createVarsResolver.createVarsResolver((_, { radius }, { size }) => ({
  root: {
    "--pill-fz": getSize.getSize(size, "pill-fz"),
    "--pill-height": getSize.getSize(size, "pill-height"),
    "--pill-radius": radius === void 0 ? void 0 : getSize.getRadius(radius)
  }
}));
const Pill = factory.factory((_props, ref) => {
  const props = useProps.useProps("Pill", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    variant,
    children,
    withRemoveButton,
    onRemove,
    removeButtonProps,
    radius,
    size,
    disabled,
    mod,
    ...others
  } = props;
  const ctx = PillGroup_context.usePillGroupContext();
  const pillsInputCtx = PillsInput_context.usePillsInputContext();
  const _size = size || ctx?.size || void 0;
  const _variant = pillsInputCtx?.variant === "filled" ? "contrast" : variant || "default";
  const getStyles = useStyles.useStyles({
    name: "Pill",
    classes: Pill_module,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver,
    stylesCtx: { size: _size }
  });
  return /* @__PURE__ */ jsxRuntime.jsxs(
    Box.Box,
    {
      component: "span",
      ref,
      variant: _variant,
      size: _size,
      ...getStyles("root", { variant: _variant }),
      mod: [
        { "with-remove": withRemoveButton && !disabled, disabled: disabled || ctx?.disabled },
        mod
      ],
      ...others,
      children: [
        /* @__PURE__ */ jsxRuntime.jsx("span", { ...getStyles("label"), children }),
        withRemoveButton && /* @__PURE__ */ jsxRuntime.jsx(
          CloseButton.CloseButton,
          {
            variant: "transparent",
            radius,
            tabIndex: -1,
            "aria-hidden": true,
            unstyled,
            ...removeButtonProps,
            ...getStyles("remove", {
              className: removeButtonProps?.className,
              style: removeButtonProps?.style
            }),
            onMouseDown: (event) => {
              event.preventDefault();
              event.stopPropagation();
              removeButtonProps?.onMouseDown?.(event);
            },
            onClick: (event) => {
              event.stopPropagation();
              onRemove?.();
              removeButtonProps?.onClick?.(event);
            }
          }
        )
      ]
    }
  );
});
Pill.classes = Pill_module;
Pill.displayName = "@mantine/core/Pill";
Pill.Group = PillGroup.PillGroup;

exports.Pill = Pill;
//# sourceMappingURL=Pill.cjs.map
