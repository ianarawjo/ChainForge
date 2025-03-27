'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var hooks = require('@mantine/hooks');
require('react');
require('clsx');
require('../../../core/MantineProvider/Mantine.context.cjs');
require('../../../core/MantineProvider/default-theme.cjs');
require('../../../core/MantineProvider/MantineProvider.cjs');
require('../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../../core/MantineProvider/use-props/use-props.cjs');
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
require('../../../core/Box/Box.cjs');
var factory = require('../../../core/factory/factory.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');
var Input = require('../../Input/Input.cjs');
var Combobox_context = require('../Combobox.context.cjs');
var useComboboxTargetProps = require('../use-combobox-target-props/use-combobox-target-props.cjs');
var Combobox_module = require('../Combobox.module.css.cjs');

const defaultProps = {
  withAriaAttributes: true,
  withKeyboardNavigation: true
};
const ComboboxSearch = factory.factory((_props, ref) => {
  const props = useProps.useProps("ComboboxSearch", defaultProps, _props);
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
  const ctx = Combobox_context.useComboboxContext();
  const _styles = ctx.getStyles("search");
  const targetProps = useComboboxTargetProps.useComboboxTargetProps({
    targetType: "input",
    withAriaAttributes,
    withKeyboardNavigation,
    withExpandedAttribute: false,
    onKeyDown,
    autoComplete: "off"
  });
  return /* @__PURE__ */ jsxRuntime.jsx(
    Input.Input,
    {
      ref: hooks.useMergedRef(ref, ctx.store.searchRef),
      classNames: [{ input: _styles.className }, classNames],
      styles: [{ input: _styles.style }, styles],
      size: size || ctx.size,
      ...targetProps,
      ...others,
      __staticSelector: "Combobox"
    }
  );
});
ComboboxSearch.classes = Combobox_module;
ComboboxSearch.displayName = "@mantine/core/ComboboxSearch";

exports.ComboboxSearch = ComboboxSearch;
//# sourceMappingURL=ComboboxSearch.cjs.map
