'use client';
import { jsx } from 'react/jsx-runtime';
import { forwardRef, cloneElement } from 'react';
import { isElement } from '../../../core/utils/is-element/is-element.mjs';
import { createEventHandler } from '../../../core/utils/create-event-handler/create-event-handler.mjs';
import '@mantine/hooks';
import 'clsx';
import '../../../core/MantineProvider/Mantine.context.mjs';
import '../../../core/MantineProvider/default-theme.mjs';
import '../../../core/MantineProvider/MantineProvider.mjs';
import '../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../../core/MantineProvider/use-props/use-props.mjs';
import '../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../../core/Box/Box.mjs';
import '../../../core/DirectionProvider/DirectionProvider.mjs';
import { Popover } from '../../Popover/Popover.mjs';
import '../../Popover/PopoverDropdown/PopoverDropdown.mjs';
import '../../Popover/PopoverTarget/PopoverTarget.mjs';
import { useMenuContext } from '../Menu.context.mjs';

const defaultProps = {
  refProp: "ref"
};
const MenuTarget = forwardRef((props, ref) => {
  const { children, refProp, ...others } = useProps("MenuTarget", defaultProps, props);
  if (!isElement(children)) {
    throw new Error(
      "Menu.Target component children should be an element or a component that accepts ref. Fragments, strings, numbers and other primitive values are not supported"
    );
  }
  const ctx = useMenuContext();
  const _childrenProps = children.props;
  const onClick = createEventHandler(_childrenProps.onClick, () => {
    if (ctx.trigger === "click") {
      ctx.toggleDropdown();
    } else if (ctx.trigger === "click-hover") {
      ctx.setOpenedViaClick(true);
      if (!ctx.opened) {
        ctx.openDropdown();
      }
    }
  });
  const onMouseEnter = createEventHandler(
    _childrenProps.onMouseEnter,
    () => (ctx.trigger === "hover" || ctx.trigger === "click-hover") && ctx.openDropdown()
  );
  const onMouseLeave = createEventHandler(_childrenProps.onMouseLeave, () => {
    if (ctx.trigger === "hover") {
      ctx.closeDropdown();
    } else if (ctx.trigger === "click-hover" && !ctx.openedViaClick) {
      ctx.closeDropdown();
    }
  });
  return /* @__PURE__ */ jsx(Popover.Target, { refProp, popupType: "menu", ref, ...others, children: cloneElement(children, {
    onClick,
    onMouseEnter,
    onMouseLeave,
    "data-expanded": ctx.opened ? true : void 0
  }) });
});
MenuTarget.displayName = "@mantine/core/MenuTarget";

export { MenuTarget };
//# sourceMappingURL=MenuTarget.mjs.map
