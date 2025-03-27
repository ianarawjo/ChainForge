'use client';
import { jsxs, jsx } from 'react/jsx-runtime';
import { useId, useUncontrolled } from '@mantine/hooks';
import 'react';
import { getFontSize, getSize, getRadius } from '../../core/utils/get-size/get-size.mjs';
import { createVarsResolver } from '../../core/styles-api/create-vars-resolver/create-vars-resolver.mjs';
import 'clsx';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../core/MantineProvider/use-props/use-props.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { useStyles } from '../../core/styles-api/use-styles/use-styles.mjs';
import { extractStyleProps } from '../../core/Box/style-props/extract-style-props/extract-style-props.mjs';
import { Box } from '../../core/Box/Box.mjs';
import { factory } from '../../core/factory/factory.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import '../Checkbox/Checkbox.mjs';
import '../Checkbox/CheckboxGroup/CheckboxGroup.mjs';
import { CheckIcon } from '../Checkbox/CheckIcon.mjs';
import '../Checkbox/CheckboxIndicator/CheckboxIndicator.mjs';
import '../Checkbox/CheckboxCard/CheckboxCard.mjs';
import '../Checkbox/CheckboxCard/CheckboxCard.context.mjs';
import '../Checkbox/CheckboxGroup.context.mjs';
import { useChipGroupContext } from './ChipGroup.context.mjs';
import { ChipGroup } from './ChipGroup/ChipGroup.mjs';
import classes from './Chip.module.css.mjs';

const defaultProps = {
  type: "checkbox"
};
const varsResolver = createVarsResolver(
  (theme, { size, radius, variant, color, autoContrast }) => {
    const colors = theme.variantColorResolver({
      color: color || theme.primaryColor,
      theme,
      variant: variant || "filled",
      autoContrast
    });
    return {
      root: {
        "--chip-fz": getFontSize(size),
        "--chip-size": getSize(size, "chip-size"),
        "--chip-radius": radius === void 0 ? void 0 : getRadius(radius),
        "--chip-checked-padding": getSize(size, "chip-checked-padding"),
        "--chip-padding": getSize(size, "chip-padding"),
        "--chip-icon-size": getSize(size, "chip-icon-size"),
        "--chip-bg": color || variant ? colors.background : void 0,
        "--chip-hover": color || variant ? colors.hover : void 0,
        "--chip-color": color || variant ? colors.color : void 0,
        "--chip-bd": color || variant ? colors.border : void 0,
        "--chip-spacing": getSize(size, "chip-spacing")
      }
    };
  }
);
const Chip = factory((_props, ref) => {
  const props = useProps("Chip", defaultProps, _props);
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
  const getStyles = useStyles({
    name: "Chip",
    classes,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  const ctx = useChipGroupContext();
  const uuid = useId(id);
  const { styleProps, rest } = extractStyleProps(others);
  const [_value, setValue] = useUncontrolled({
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
  return /* @__PURE__ */ jsxs(
    Box,
    {
      size,
      variant,
      ref: rootRef,
      mod,
      ...getStyles("root"),
      ...styleProps,
      ...wrapperProps,
      children: [
        /* @__PURE__ */ jsx(
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
        /* @__PURE__ */ jsxs(
          "label",
          {
            htmlFor: uuid,
            "data-checked": _checked || void 0,
            "data-disabled": disabled || void 0,
            ...getStyles("label", { variant: variant || "filled" }),
            children: [
              _checked && /* @__PURE__ */ jsx("span", { ...getStyles("iconWrapper"), children: icon || /* @__PURE__ */ jsx(CheckIcon, { ...getStyles("checkIcon") }) }),
              /* @__PURE__ */ jsx("span", { children })
            ]
          }
        )
      ]
    }
  );
});
Chip.classes = classes;
Chip.displayName = "@mantine/core/Chip";
Chip.Group = ChipGroup;

export { Chip };
//# sourceMappingURL=Chip.mjs.map
