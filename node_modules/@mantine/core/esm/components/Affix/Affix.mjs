'use client';
import { jsx } from 'react/jsx-runtime';
import 'react';
import { getDefaultZIndex } from '../../core/utils/get-default-z-index/get-default-z-index.mjs';
import { getSpacing } from '../../core/utils/get-size/get-size.mjs';
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
import '../Portal/Portal.mjs';
import { OptionalPortal } from '../Portal/OptionalPortal.mjs';
import classes from './Affix.module.css.mjs';

const defaultProps = {
  position: { bottom: 0, right: 0 },
  zIndex: getDefaultZIndex("modal"),
  withinPortal: true
};
const varsResolver = createVarsResolver((_, { zIndex, position }) => ({
  root: {
    "--affix-z-index": zIndex?.toString(),
    "--affix-top": getSpacing(position?.top),
    "--affix-left": getSpacing(position?.left),
    "--affix-bottom": getSpacing(position?.bottom),
    "--affix-right": getSpacing(position?.right)
  }
}));
const Affix = factory((_props, ref) => {
  const props = useProps("Affix", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    portalProps,
    zIndex,
    withinPortal,
    position,
    ...others
  } = props;
  const getStyles = useStyles({
    name: "Affix",
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
  return /* @__PURE__ */ jsx(OptionalPortal, { ...portalProps, withinPortal, children: /* @__PURE__ */ jsx(Box, { ref, ...getStyles("root"), ...others }) });
});
Affix.classes = classes;
Affix.displayName = "@mantine/core/Affix";

export { Affix };
//# sourceMappingURL=Affix.mjs.map
