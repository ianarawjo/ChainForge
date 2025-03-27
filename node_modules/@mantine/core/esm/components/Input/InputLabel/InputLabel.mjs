'use client';
import { jsxs, jsx } from 'react/jsx-runtime';
import 'react';
import { getFontSize } from '../../../core/utils/get-size/get-size.mjs';
import '@mantine/hooks';
import { createVarsResolver } from '../../../core/styles-api/create-vars-resolver/create-vars-resolver.mjs';
import 'clsx';
import '../../../core/MantineProvider/Mantine.context.mjs';
import '../../../core/MantineProvider/default-theme.mjs';
import '../../../core/MantineProvider/MantineProvider.mjs';
import '../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../../core/MantineProvider/use-props/use-props.mjs';
import '../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { useStyles } from '../../../core/styles-api/use-styles/use-styles.mjs';
import { Box } from '../../../core/Box/Box.mjs';
import { factory } from '../../../core/factory/factory.mjs';
import '../../../core/DirectionProvider/DirectionProvider.mjs';
import { useInputWrapperContext } from '../InputWrapper.context.mjs';
import classes from '../Input.module.css.mjs';

const defaultProps = {
  labelElement: "label"
};
const varsResolver = createVarsResolver((_, { size }) => ({
  label: {
    "--input-label-size": getFontSize(size),
    "--input-asterisk-color": void 0
  }
}));
const InputLabel = factory((_props, ref) => {
  const props = useProps("InputLabel", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    labelElement,
    size,
    required,
    htmlFor,
    onMouseDown,
    children,
    __staticSelector,
    variant,
    mod,
    ...others
  } = useProps("InputLabel", defaultProps, props);
  const _getStyles = useStyles({
    name: ["InputWrapper", __staticSelector],
    props,
    classes,
    className,
    style,
    classNames,
    styles,
    unstyled,
    rootSelector: "label",
    vars,
    varsResolver
  });
  const ctx = useInputWrapperContext();
  const getStyles = ctx?.getStyles || _getStyles;
  return /* @__PURE__ */ jsxs(
    Box,
    {
      ...getStyles("label", ctx?.getStyles ? { className, style } : void 0),
      component: labelElement,
      variant,
      size,
      ref,
      htmlFor: labelElement === "label" ? htmlFor : void 0,
      mod: [{ required }, mod],
      onMouseDown: (event) => {
        onMouseDown?.(event);
        if (!event.defaultPrevented && event.detail > 1) {
          event.preventDefault();
        }
      },
      ...others,
      children: [
        children,
        required && /* @__PURE__ */ jsx("span", { ...getStyles("required"), "aria-hidden": true, children: " *" })
      ]
    }
  );
});
InputLabel.classes = classes;
InputLabel.displayName = "@mantine/core/InputLabel";

export { InputLabel };
//# sourceMappingURL=InputLabel.mjs.map
