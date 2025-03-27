'use client';
import { jsx } from 'react/jsx-runtime';
import cx from 'clsx';
import 'react';
import '@mantine/hooks';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../core/MantineProvider/use-props/use-props.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../core/Box/Box.mjs';
import { polymorphicFactory } from '../../core/factory/polymorphic-factory.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import { Text } from '../Text/Text.mjs';
import classes from './Anchor.module.css.mjs';

const defaultProps = {
  underline: "hover"
};
const Anchor = polymorphicFactory((props, ref) => {
  const { underline, className, unstyled, mod, ...others } = useProps(
    "Anchor",
    defaultProps,
    props
  );
  return /* @__PURE__ */ jsx(
    Text,
    {
      component: "a",
      ref,
      className: cx({ [classes.root]: !unstyled }, className),
      ...others,
      mod: [{ underline }, mod],
      __staticSelector: "Anchor",
      unstyled
    }
  );
});
Anchor.classes = classes;
Anchor.displayName = "@mantine/core/Anchor";

export { Anchor };
//# sourceMappingURL=Anchor.mjs.map
