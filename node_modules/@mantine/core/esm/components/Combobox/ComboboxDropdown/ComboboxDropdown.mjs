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
import { Popover } from '../../Popover/Popover.mjs';
import '../../Popover/PopoverDropdown/PopoverDropdown.mjs';
import '../../Popover/PopoverTarget/PopoverTarget.mjs';
import { useComboboxContext } from '../Combobox.context.mjs';
import classes from '../Combobox.module.css.mjs';

const defaultProps = {};
const ComboboxDropdown = factory((props, ref) => {
  const { classNames, styles, className, style, hidden, ...others } = useProps(
    "ComboboxDropdown",
    defaultProps,
    props
  );
  const ctx = useComboboxContext();
  return /* @__PURE__ */ jsx(
    Popover.Dropdown,
    {
      ...others,
      ref,
      role: "presentation",
      "data-hidden": hidden || void 0,
      ...ctx.getStyles("dropdown", { className, style, classNames, styles })
    }
  );
});
ComboboxDropdown.classes = classes;
ComboboxDropdown.displayName = "@mantine/core/ComboboxDropdown";

export { ComboboxDropdown };
//# sourceMappingURL=ComboboxDropdown.mjs.map
