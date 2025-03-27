'use client';
import { jsx } from 'react/jsx-runtime';
import { useRef } from 'react';
import { useMergedRef } from '@mantine/hooks';
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
import { useFloatingIndicator } from './use-floating-indicator.mjs';
import classes from './FloatingIndicator.module.css.mjs';

const defaultProps = {};
const varsResolver = createVarsResolver(
  (_theme, { transitionDuration }) => ({
    root: {
      "--transition-duration": typeof transitionDuration === "number" ? `${transitionDuration}ms` : transitionDuration
    }
  })
);
const FloatingIndicator = factory((_props, ref) => {
  const props = useProps("FloatingIndicator", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    target,
    parent,
    transitionDuration,
    mod,
    displayAfterTransitionEnd,
    ...others
  } = props;
  const getStyles = useStyles({
    name: "FloatingIndicator",
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
  const innerRef = useRef(null);
  const { initialized, hidden } = useFloatingIndicator({
    target,
    parent,
    ref: innerRef,
    displayAfterTransitionEnd
  });
  const mergedRef = useMergedRef(ref, innerRef);
  if (!target || !parent) {
    return null;
  }
  return /* @__PURE__ */ jsx(Box, { ref: mergedRef, mod: [{ initialized, hidden }, mod], ...getStyles("root"), ...others });
});
FloatingIndicator.displayName = "@mantine/core/FloatingIndicator";
FloatingIndicator.classes = classes;

export { FloatingIndicator };
//# sourceMappingURL=FloatingIndicator.mjs.map
