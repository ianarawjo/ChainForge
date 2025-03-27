'use client';
import { jsx } from 'react/jsx-runtime';
import 'react';
import { getSize, getRadius } from '../../../core/utils/get-size/get-size.mjs';
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
import { ProgressProvider } from '../Progress.context.mjs';
import classes from '../Progress.module.css.mjs';

const defaultProps = {};
const varsResolver = createVarsResolver(
  (_, { size, radius, transitionDuration }) => ({
    root: {
      "--progress-size": getSize(size, "progress-size"),
      "--progress-radius": radius === void 0 ? void 0 : getRadius(radius),
      "--progress-transition-duration": typeof transitionDuration === "number" ? `${transitionDuration}ms` : void 0
    }
  })
);
const ProgressRoot = factory((_props, ref) => {
  const props = useProps("ProgressRoot", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    autoContrast,
    transitionDuration,
    ...others
  } = props;
  const getStyles = useStyles({
    name: "Progress",
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
  return /* @__PURE__ */ jsx(ProgressProvider, { value: { getStyles, autoContrast }, children: /* @__PURE__ */ jsx(Box, { ref, ...getStyles("root"), ...others }) });
});
ProgressRoot.classes = classes;
ProgressRoot.displayName = "@mantine/core/ProgressRoot";

export { ProgressRoot };
//# sourceMappingURL=ProgressRoot.mjs.map
