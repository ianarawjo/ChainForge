'use client';
import { jsx } from 'react/jsx-runtime';
import { useEffect } from 'react';
import { useId } from '@mantine/hooks';
import 'clsx';
import '../../../core/MantineProvider/Mantine.context.mjs';
import '../../../core/MantineProvider/default-theme.mjs';
import '../../../core/MantineProvider/MantineProvider.mjs';
import '../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../../core/MantineProvider/use-props/use-props.mjs';
import '../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { Box } from '../../../core/Box/Box.mjs';
import { factory } from '../../../core/factory/factory.mjs';
import '../../../core/DirectionProvider/DirectionProvider.mjs';
import { useComboboxContext } from '../Combobox.context.mjs';
import classes from '../Combobox.module.css.mjs';

const defaultProps = {};
const ComboboxOptions = factory((_props, ref) => {
  const props = useProps("ComboboxOptions", defaultProps, _props);
  const { classNames, className, style, styles, id, onMouseDown, labelledBy, ...others } = props;
  const ctx = useComboboxContext();
  const _id = useId(id);
  useEffect(() => {
    ctx.store.setListId(_id);
  }, [_id]);
  return /* @__PURE__ */ jsx(
    Box,
    {
      ref,
      ...ctx.getStyles("options", { className, style, classNames, styles }),
      ...others,
      id: _id,
      role: "listbox",
      "aria-labelledby": labelledBy,
      onMouseDown: (event) => {
        event.preventDefault();
        onMouseDown?.(event);
      }
    }
  );
});
ComboboxOptions.classes = classes;
ComboboxOptions.displayName = "@mantine/core/ComboboxOptions";

export { ComboboxOptions };
//# sourceMappingURL=ComboboxOptions.mjs.map
