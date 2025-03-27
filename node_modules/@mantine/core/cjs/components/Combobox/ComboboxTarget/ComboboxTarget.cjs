'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var hooks = require('@mantine/hooks');
var isElement = require('../../../core/utils/is-element/is-element.cjs');
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
var Popover = require('../../Popover/Popover.cjs');
require('../../Popover/PopoverDropdown/PopoverDropdown.cjs');
require('../../Popover/PopoverTarget/PopoverTarget.cjs');
var Combobox_context = require('../Combobox.context.cjs');
var useComboboxTargetProps = require('../use-combobox-target-props/use-combobox-target-props.cjs');

const defaultProps = {
  refProp: "ref",
  targetType: "input",
  withKeyboardNavigation: true,
  withAriaAttributes: true,
  withExpandedAttribute: false,
  autoComplete: "off"
};
const ComboboxTarget = factory.factory((props, ref) => {
  const {
    children,
    refProp,
    withKeyboardNavigation,
    withAriaAttributes,
    withExpandedAttribute,
    targetType,
    autoComplete,
    ...others
  } = useProps.useProps("ComboboxTarget", defaultProps, props);
  if (!isElement.isElement(children)) {
    throw new Error(
      "Combobox.Target component children should be an element or a component that accepts ref. Fragments, strings, numbers and other primitive values are not supported"
    );
  }
  const ctx = Combobox_context.useComboboxContext();
  const targetProps = useComboboxTargetProps.useComboboxTargetProps({
    targetType,
    withAriaAttributes,
    withKeyboardNavigation,
    withExpandedAttribute,
    onKeyDown: children.props.onKeyDown,
    autoComplete
  });
  const clonedElement = React.cloneElement(children, {
    ...targetProps,
    ...others
  });
  return /* @__PURE__ */ jsxRuntime.jsx(Popover.Popover.Target, { ref: hooks.useMergedRef(ref, ctx.store.targetRef), children: clonedElement });
});
ComboboxTarget.displayName = "@mantine/core/ComboboxTarget";

exports.ComboboxTarget = ComboboxTarget;
//# sourceMappingURL=ComboboxTarget.cjs.map
