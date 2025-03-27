'use client';
import { cloneElement } from 'react';
import cx from 'clsx';
import { useMergedRef } from '@mantine/hooks';
import { isElement } from '../../../core/utils/is-element/is-element.mjs';
import 'react/jsx-runtime';
import { getRefProp } from '../../../core/utils/get-ref-prop/get-ref-prop.mjs';
import '../../../core/MantineProvider/Mantine.context.mjs';
import '../../../core/MantineProvider/default-theme.mjs';
import '../../../core/MantineProvider/MantineProvider.mjs';
import '../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../../core/MantineProvider/use-props/use-props.mjs';
import '../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../../core/Box/Box.mjs';
import { factory } from '../../../core/factory/factory.mjs';
import '../../../core/DirectionProvider/DirectionProvider.mjs';
import { usePopoverContext } from '../Popover.context.mjs';

const defaultProps = {
  refProp: "ref",
  popupType: "dialog"
};
const PopoverTarget = factory((props, ref) => {
  const { children, refProp, popupType, ...others } = useProps(
    "PopoverTarget",
    defaultProps,
    props
  );
  if (!isElement(children)) {
    throw new Error(
      "Popover.Target component children should be an element or a component that accepts ref. Fragments, strings, numbers and other primitive values are not supported"
    );
  }
  const forwardedProps = others;
  const ctx = usePopoverContext();
  const targetRef = useMergedRef(ctx.reference, getRefProp(children), ref);
  const accessibleProps = ctx.withRoles ? {
    "aria-haspopup": popupType,
    "aria-expanded": ctx.opened,
    "aria-controls": ctx.getDropdownId(),
    id: ctx.getTargetId()
  } : {};
  return cloneElement(children, {
    ...forwardedProps,
    ...accessibleProps,
    ...ctx.targetProps,
    className: cx(
      ctx.targetProps.className,
      forwardedProps.className,
      children.props.className
    ),
    [refProp]: targetRef,
    ...!ctx.controlled ? { onClick: ctx.onToggle } : null
  });
});
PopoverTarget.displayName = "@mantine/core/PopoverTarget";

export { PopoverTarget };
//# sourceMappingURL=PopoverTarget.mjs.map
