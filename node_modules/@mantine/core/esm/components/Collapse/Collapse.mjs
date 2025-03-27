'use client';
import { jsx } from 'react/jsx-runtime';
import { useReducedMotion } from '@mantine/hooks';
import 'react';
import 'clsx';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import { useMantineTheme } from '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../core/MantineProvider/use-props/use-props.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { getStyleObject } from '../../core/Box/get-style-object/get-style-object.mjs';
import { Box } from '../../core/Box/Box.mjs';
import { factory } from '../../core/factory/factory.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import { useCollapse } from './use-collapse.mjs';

const defaultProps = {
  transitionDuration: 200,
  transitionTimingFunction: "ease",
  animateOpacity: true
};
const Collapse = factory((props, ref) => {
  const {
    children,
    in: opened,
    transitionDuration,
    transitionTimingFunction,
    style,
    onTransitionEnd,
    animateOpacity,
    ...others
  } = useProps("Collapse", defaultProps, props);
  const theme = useMantineTheme();
  const shouldReduceMotion = useReducedMotion();
  const reduceMotion = theme.respectReducedMotion ? shouldReduceMotion : false;
  const duration = reduceMotion ? 0 : transitionDuration;
  const getCollapseProps = useCollapse({
    opened,
    transitionDuration: duration,
    transitionTimingFunction,
    onTransitionEnd
  });
  if (duration === 0) {
    return opened ? /* @__PURE__ */ jsx(Box, { ...others, children }) : null;
  }
  return /* @__PURE__ */ jsx(
    Box,
    {
      ...getCollapseProps({
        style: {
          opacity: opened || !animateOpacity ? 1 : 0,
          transition: animateOpacity ? `opacity ${duration}ms ${transitionTimingFunction}` : "none",
          ...getStyleObject(style, theme)
        },
        ref,
        ...others
      }),
      children
    }
  );
});
Collapse.displayName = "@mantine/core/Collapse";

export { Collapse };
//# sourceMappingURL=Collapse.mjs.map
