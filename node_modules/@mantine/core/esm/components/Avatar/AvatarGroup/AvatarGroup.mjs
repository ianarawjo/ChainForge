'use client';
import { jsx } from 'react/jsx-runtime';
import 'react';
import { getSpacing } from '../../../core/utils/get-size/get-size.mjs';
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
import { AvatarGroupProvider } from './AvatarGroup.context.mjs';
import classes from '../Avatar.module.css.mjs';

const defaultProps = {};
const varsResolver = createVarsResolver((_, { spacing }) => ({
  group: {
    "--ag-spacing": getSpacing(spacing)
  }
}));
const AvatarGroup = factory((_props, ref) => {
  const props = useProps("AvatarGroup", defaultProps, _props);
  const { classNames, className, style, styles, unstyled, vars, spacing, ...others } = props;
  const getStyles = useStyles({
    name: "AvatarGroup",
    classes,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver,
    rootSelector: "group"
  });
  return /* @__PURE__ */ jsx(AvatarGroupProvider, { value: true, children: /* @__PURE__ */ jsx(Box, { ref, ...getStyles("group"), ...others }) });
});
AvatarGroup.classes = classes;
AvatarGroup.displayName = "@mantine/core/AvatarGroup";

export { AvatarGroup };
//# sourceMappingURL=AvatarGroup.mjs.map
