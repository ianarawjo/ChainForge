'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var hooks = require('@mantine/hooks');
var isElement = require('../../core/utils/is-element/is-element.cjs');
require('clsx');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
require('../../core/Box/Box.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
var VisuallyHidden = require('../VisuallyHidden/VisuallyHidden.cjs');

function FocusTrap({
  children,
  active = true,
  refProp = "ref",
  innerRef
}) {
  const focusTrapRef = hooks.useFocusTrap(active);
  const ref = hooks.useMergedRef(focusTrapRef, innerRef);
  if (!isElement.isElement(children)) {
    return children;
  }
  return React.cloneElement(children, { [refProp]: ref });
}
function FocusTrapInitialFocus(props) {
  return /* @__PURE__ */ jsxRuntime.jsx(VisuallyHidden.VisuallyHidden, { tabIndex: -1, "data-autofocus": true, ...props });
}
FocusTrap.displayName = "@mantine/core/FocusTrap";
FocusTrapInitialFocus.displayName = "@mantine/core/FocusTrapInitialFocus";
FocusTrap.InitialFocus = FocusTrapInitialFocus;

exports.FocusTrap = FocusTrap;
exports.FocusTrapInitialFocus = FocusTrapInitialFocus;
//# sourceMappingURL=FocusTrap.cjs.map
