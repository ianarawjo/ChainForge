'use client';
import { jsx } from 'react/jsx-runtime';
import { rem } from '../../../core/utils/units-converters/rem.mjs';
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

const defaultProps = {};
const varsResolver = createVarsResolver((_, { size }) => ({
  description: {
    "--input-description-size": size === void 0 ? void 0 : `calc(${getFontSize(size)} - ${rem(2)})`
  }
}));
const InputDescription = factory((_props, ref) => {
  const props = useProps("InputDescription", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    size,
    __staticSelector,
    __inheritStyles = true,
    variant,
    ...others
  } = useProps("InputDescription", defaultProps, props);
  const ctx = useInputWrapperContext();
  const _getStyles = useStyles({
    name: ["InputWrapper", __staticSelector],
    props,
    classes,
    className,
    style,
    classNames,
    styles,
    unstyled,
    rootSelector: "description",
    vars,
    varsResolver
  });
  const getStyles = __inheritStyles && ctx?.getStyles || _getStyles;
  return /* @__PURE__ */ jsx(
    Box,
    {
      component: "p",
      ref,
      variant,
      size,
      ...getStyles("description", ctx?.getStyles ? { className, style } : void 0),
      ...others
    }
  );
});
InputDescription.classes = classes;
InputDescription.displayName = "@mantine/core/InputDescription";

export { InputDescription };
//# sourceMappingURL=InputDescription.mjs.map
