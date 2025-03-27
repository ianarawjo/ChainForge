'use client';
import { jsx } from 'react/jsx-runtime';
import { useMergedRef } from '@mantine/hooks';
import 'react';
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
import { Input } from '../../Input/Input.mjs';
import { useComboboxContext } from '../Combobox.context.mjs';
import { useComboboxTargetProps } from '../use-combobox-target-props/use-combobox-target-props.mjs';
import classes from '../Combobox.module.css.mjs';

const defaultProps = {
  withAriaAttributes: true,
  withKeyboardNavigation: true
};
const ComboboxSearch = factory((_props, ref) => {
  const props = useProps("ComboboxSearch", defaultProps, _props);
  const {
    classNames,
    styles,
    unstyled,
    vars,
    withAriaAttributes,
    onKeyDown,
    withKeyboardNavigation,
    size,
    ...others
  } = props;
  const ctx = useComboboxContext();
  const _styles = ctx.getStyles("search");
  const targetProps = useComboboxTargetProps({
    targetType: "input",
    withAriaAttributes,
    withKeyboardNavigation,
    withExpandedAttribute: false,
    onKeyDown,
    autoComplete: "off"
  });
  return /* @__PURE__ */ jsx(
    Input,
    {
      ref: useMergedRef(ref, ctx.store.searchRef),
      classNames: [{ input: _styles.className }, classNames],
      styles: [{ input: _styles.style }, styles],
      size: size || ctx.size,
      ...targetProps,
      ...others,
      __staticSelector: "Combobox"
    }
  );
});
ComboboxSearch.classes = classes;
ComboboxSearch.displayName = "@mantine/core/ComboboxSearch";

export { ComboboxSearch };
//# sourceMappingURL=ComboboxSearch.mjs.map
