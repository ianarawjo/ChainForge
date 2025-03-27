'use client';
import { jsx } from 'react/jsx-runtime';
import { cloneElement } from 'react';
import { useFocusTrap, useMergedRef } from '@mantine/hooks';
import { isElement } from '../../core/utils/is-element/is-element.mjs';
import 'clsx';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../core/Box/Box.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import { VisuallyHidden } from '../VisuallyHidden/VisuallyHidden.mjs';

function FocusTrap({
  children,
  active = true,
  refProp = "ref",
  innerRef
}) {
  const focusTrapRef = useFocusTrap(active);
  const ref = useMergedRef(focusTrapRef, innerRef);
  if (!isElement(children)) {
    return children;
  }
  return cloneElement(children, { [refProp]: ref });
}
function FocusTrapInitialFocus(props) {
  return /* @__PURE__ */ jsx(VisuallyHidden, { tabIndex: -1, "data-autofocus": true, ...props });
}
FocusTrap.displayName = "@mantine/core/FocusTrap";
FocusTrapInitialFocus.displayName = "@mantine/core/FocusTrapInitialFocus";
FocusTrap.InitialFocus = FocusTrapInitialFocus;

export { FocusTrap, FocusTrapInitialFocus };
//# sourceMappingURL=FocusTrap.mjs.map
