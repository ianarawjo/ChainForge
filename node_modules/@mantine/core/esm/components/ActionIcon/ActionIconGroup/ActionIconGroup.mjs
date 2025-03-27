'use client';
import { jsx } from 'react/jsx-runtime';
import { rem } from '../../../core/utils/units-converters/rem.mjs';
import 'react';
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
import classes from '../ActionIcon.module.css.mjs';

const defaultProps = {
  orientation: "horizontal"
};
const varsResolver = createVarsResolver((_, { borderWidth }) => ({
  group: { "--ai-border-width": rem(borderWidth) }
}));
const ActionIconGroup = factory((_props, ref) => {
  const props = useProps("ActionIconGroup", defaultProps, _props);
  const {
    className,
    style,
    classNames,
    styles,
    unstyled,
    orientation,
    vars,
    borderWidth,
    variant,
    mod,
    ...others
  } = useProps("ActionIconGroup", defaultProps, _props);
  const getStyles = useStyles({
    name: "ActionIconGroup",
    props,
    classes,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver,
    rootSelector: "group"
  });
  return /* @__PURE__ */ jsx(
    Box,
    {
      ...getStyles("group"),
      ref,
      variant,
      mod: [{ "data-orientation": orientation }, mod],
      role: "group",
      ...others
    }
  );
});
ActionIconGroup.classes = classes;
ActionIconGroup.displayName = "@mantine/core/ActionIconGroup";

export { ActionIconGroup };
//# sourceMappingURL=ActionIconGroup.mjs.map
