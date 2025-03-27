'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var hooks = require('@mantine/hooks');
require('react');
var getSize = require('../../core/utils/get-size/get-size.cjs');
var createVarsResolver = require('../../core/styles-api/create-vars-resolver/create-vars-resolver.cjs');
require('clsx');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../core/MantineProvider/use-props/use-props.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var useStyles = require('../../core/styles-api/use-styles/use-styles.cjs');
var extractStyleProps = require('../../core/Box/style-props/extract-style-props/extract-style-props.cjs');
var Box = require('../../core/Box/Box.cjs');
var factory = require('../../core/factory/factory.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
require('../Checkbox/Checkbox.cjs');
require('../Checkbox/CheckboxGroup/CheckboxGroup.cjs');
var CheckIcon = require('../Checkbox/CheckIcon.cjs');
require('../Checkbox/CheckboxIndicator/CheckboxIndicator.cjs');
require('../Checkbox/CheckboxCard/CheckboxCard.cjs');
require('../Checkbox/CheckboxCard/CheckboxCard.context.cjs');
require('../Checkbox/CheckboxGroup.context.cjs');
var ChipGroup_context = require('./ChipGroup.context.cjs');
var ChipGroup = require('./ChipGroup/ChipGroup.cjs');
var Chip_module = require('./Chip.module.css.cjs');

const defaultProps = {
  type: "checkbox"
};
const varsResolver = createVarsResolver.createVarsResolver(
  (theme, { size, radius, variant, color, autoContrast }) => {
    const colors = theme.variantColorResolver({
      color: color || theme.primaryColor,
      theme,
      variant: variant || "filled",
      autoContrast
    });
    return {
      root: {
        "--chip-fz": getSize.getFontSize(size),
        "--chip-size": getSize.getSize(size, "chip-size"),
        "--chip-radius": radius === void 0 ? void 0 : getSize.getRadius(radius),
        "--chip-checked-padding": getSize.getSize(size, "chip-checked-padding"),
        "--chip-padding": getSize.getSize(size, "chip-padding"),
        "--chip-icon-size": getSize.getSize(size, "chip-icon-size"),
        "--chip-bg": color || variant ? colors.background : void 0,
        "--chip-hover": color || variant ? colors.hover : void 0,
        "--chip-color": color || variant ? colors.color : void 0,
        "--chip-bd": color || variant ? colors.border : void 0,
        "--chip-spacing": getSize.getSize(size, "chip-spacing")
      }
    };
  }
);
const Chip = factory.factory((_props, ref) => {
  const props = useProps.useProps("Chip", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    id,
    checked,
    defaultChecked,
    onChange,
    value,
    wrapperProps,
    type,
    disabled,
    children,
    size,
    variant,
    icon,
    rootRef,
    autoContrast,
    mod,
    ...others
  } = props;
  const getStyles = useStyles.useStyles({
    name: "Chip",
    classes: Chip_module,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  const ctx = ChipGroup_context.useChipGroupContext();
  const uuid = hooks.useId(id);
  const { styleProps, rest } = extractStyleProps.extractStyleProps(others);
  const [_value, setValue] = hooks.useUncontrolled({
    value: checked,
    defaultValue: defaultChecked,
    finalValue: false,
    onChange
  });
  const contextProps = ctx ? {
    checked: ctx.isChipSelected(value),
    onChange: (event) => {
      ctx.onChange(event);
      onChange?.(event.currentTarget.checked);
    },
    type: ctx.multiple ? "checkbox" : "radio"
  } : {};
  const _checked = contextProps.checked || _value;
  return /* @__PURE__ */ jsxRuntime.jsxs(
    Box.Box,
    {
      size,
      variant,
      ref: rootRef,
      mod,
      ...getStyles("root"),
      ...styleProps,
      ...wrapperProps,
      children: [
        /* @__PURE__ */ jsxRuntime.jsx(
          "input",
          {
            type,
            ...getStyles("input"),
            checked: _checked,
            onChange: (event) => setValue(event.currentTarget.checked),
            id: uuid,
            disabled,
            ref,
            value,
            ...contextProps,
            ...rest
          }
        ),
        /* @__PURE__ */ jsxRuntime.jsxs(
          "label",
          {
            htmlFor: uuid,
            "data-checked": _checked || void 0,
            "data-disabled": disabled || void 0,
            ...getStyles("label", { variant: variant || "filled" }),
            children: [
              _checked && /* @__PURE__ */ jsxRuntime.jsx("span", { ...getStyles("iconWrapper"), children: icon || /* @__PURE__ */ jsxRuntime.jsx(CheckIcon.CheckIcon, { ...getStyles("checkIcon") }) }),
              /* @__PURE__ */ jsxRuntime.jsx("span", { children })
            ]
          }
        )
      ]
    }
  );
});
Chip.classes = Chip_module;
Chip.displayName = "@mantine/core/Chip";
Chip.Group = ChipGroup.ChipGroup;

exports.Chip = Chip;
//# sourceMappingURL=Chip.cjs.map
