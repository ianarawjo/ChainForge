'use client';
import { jsx } from 'react/jsx-runtime';
import 'react';
import '@mantine/hooks';
import 'clsx';
import '../../../core/MantineProvider/Mantine.context.mjs';
import '../../../core/MantineProvider/default-theme.mjs';
import '../../../core/MantineProvider/MantineProvider.mjs';
import '../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../../core/MantineProvider/use-props/use-props.mjs';
import '../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../../core/Box/Box.mjs';
import { factory } from '../../../core/factory/factory.mjs';
import '../../../core/DirectionProvider/DirectionProvider.mjs';
import { UnstyledButton } from '../../UnstyledButton/UnstyledButton.mjs';
import { usePaginationContext } from '../Pagination.context.mjs';
import classes from '../Pagination.module.css.mjs';

const defaultProps = {
  withPadding: true
};
const PaginationControl = factory((_props, ref) => {
  const props = useProps("PaginationControl", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    vars,
    active,
    disabled,
    withPadding,
    mod,
    ...others
  } = props;
  const ctx = usePaginationContext();
  const _disabled = disabled || ctx.disabled;
  return /* @__PURE__ */ jsx(
    UnstyledButton,
    {
      ref,
      disabled: _disabled,
      mod: [{ active, disabled: _disabled, "with-padding": withPadding }, mod],
      ...ctx.getStyles("control", { className, style, classNames, styles, active: !_disabled }),
      ...others
    }
  );
});
PaginationControl.classes = classes;
PaginationControl.displayName = "@mantine/core/PaginationControl";

export { PaginationControl };
//# sourceMappingURL=PaginationControl.mjs.map
