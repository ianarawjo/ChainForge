'use client';
'use strict';

var React = require('react');
var cx = require('clsx');
var hooks = require('@mantine/hooks');
var isElement = require('../../../core/utils/is-element/is-element.cjs');
require('react/jsx-runtime');
var getRefProp = require('../../../core/utils/get-ref-prop/get-ref-prop.cjs');
require('../../../core/MantineProvider/Mantine.context.cjs');
require('../../../core/MantineProvider/default-theme.cjs');
require('../../../core/MantineProvider/MantineProvider.cjs');
require('../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../../core/MantineProvider/use-props/use-props.cjs');
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
require('../../../core/Box/Box.cjs');
var factory = require('../../../core/factory/factory.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');
var Popover_context = require('../Popover.context.cjs');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var cx__default = /*#__PURE__*/_interopDefault(cx);

const defaultProps = {
  refProp: "ref",
  popupType: "dialog"
};
const PopoverTarget = factory.factory((props, ref) => {
  const { children, refProp, popupType, ...others } = useProps.useProps(
    "PopoverTarget",
    defaultProps,
    props
  );
  if (!isElement.isElement(children)) {
    throw new Error(
      "Popover.Target component children should be an element or a component that accepts ref. Fragments, strings, numbers and other primitive values are not supported"
    );
  }
  const forwardedProps = others;
  const ctx = Popover_context.usePopoverContext();
  const targetRef = hooks.useMergedRef(ctx.reference, getRefProp.getRefProp(children), ref);
  const accessibleProps = ctx.withRoles ? {
    "aria-haspopup": popupType,
    "aria-expanded": ctx.opened,
    "aria-controls": ctx.getDropdownId(),
    id: ctx.getTargetId()
  } : {};
  return React.cloneElement(children, {
    ...forwardedProps,
    ...accessibleProps,
    ...ctx.targetProps,
    className: cx__default.default(
      ctx.targetProps.className,
      forwardedProps.className,
      children.props.className
    ),
    [refProp]: targetRef,
    ...!ctx.controlled ? { onClick: ctx.onToggle } : null
  });
});
PopoverTarget.displayName = "@mantine/core/PopoverTarget";

exports.PopoverTarget = PopoverTarget;
//# sourceMappingURL=PopoverTarget.cjs.map
