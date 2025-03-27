'use client';
import { jsx } from 'react/jsx-runtime';
import { isElement } from '../../../core/utils/is-element/is-element.mjs';
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
import { Popover } from '../../Popover/Popover.mjs';
import '../../Popover/PopoverDropdown/PopoverDropdown.mjs';
import '../../Popover/PopoverTarget/PopoverTarget.mjs';
import { useComboboxContext } from '../Combobox.context.mjs';

const defaultProps = {
  refProp: "ref"
};
const ComboboxDropdownTarget = factory((props, ref) => {
  const { children, refProp } = useProps("ComboboxDropdownTarget", defaultProps, props);
  useComboboxContext();
  if (!isElement(children)) {
    throw new Error(
      "Combobox.DropdownTarget component children should be an element or a component that accepts ref. Fragments, strings, numbers and other primitive values are not supported"
    );
  }
  return /* @__PURE__ */ jsx(Popover.Target, { ref, refProp, children });
});
ComboboxDropdownTarget.displayName = "@mantine/core/ComboboxDropdownTarget";

export { ComboboxDropdownTarget };
//# sourceMappingURL=ComboboxDropdownTarget.mjs.map
