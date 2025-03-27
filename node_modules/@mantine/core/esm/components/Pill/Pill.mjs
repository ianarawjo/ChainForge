'use client';
import { jsxs, jsx } from 'react/jsx-runtime';
import 'react';
import { getSize, getRadius } from '../../core/utils/get-size/get-size.mjs';
import '@mantine/hooks';
import { createVarsResolver } from '../../core/styles-api/create-vars-resolver/create-vars-resolver.mjs';
import 'clsx';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../core/MantineProvider/use-props/use-props.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { useStyles } from '../../core/styles-api/use-styles/use-styles.mjs';
import { Box } from '../../core/Box/Box.mjs';
import { factory } from '../../core/factory/factory.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import '../CloseButton/CloseIcon.mjs';
import { CloseButton } from '../CloseButton/CloseButton.mjs';
import { usePillsInputContext } from '../PillsInput/PillsInput.context.mjs';
import { usePillGroupContext } from './PillGroup.context.mjs';
import { PillGroup } from './PillGroup/PillGroup.mjs';
import classes from './Pill.module.css.mjs';

const defaultProps = {
  variant: "default"
};
const varsResolver = createVarsResolver((_, { radius }, { size }) => ({
  root: {
    "--pill-fz": getSize(size, "pill-fz"),
    "--pill-height": getSize(size, "pill-height"),
    "--pill-radius": radius === void 0 ? void 0 : getRadius(radius)
  }
}));
const Pill = factory((_props, ref) => {
  const props = useProps("Pill", defaultProps, _props);
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
  const ctx = usePillGroupContext();
  const pillsInputCtx = usePillsInputContext();
  const _size = size || ctx?.size || void 0;
  const _variant = pillsInputCtx?.variant === "filled" ? "contrast" : variant || "default";
  const getStyles = useStyles({
    name: "Pill",
    classes,
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
  return /* @__PURE__ */ jsxs(
    Box,
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
        /* @__PURE__ */ jsx("span", { ...getStyles("label"), children }),
        withRemoveButton && /* @__PURE__ */ jsx(
          CloseButton,
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
Pill.classes = classes;
Pill.displayName = "@mantine/core/Pill";
Pill.Group = PillGroup;

export { Pill };
//# sourceMappingURL=Pill.mjs.map
