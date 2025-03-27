'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var hooks = require('@mantine/hooks');
require('clsx');
require('../../../core/MantineProvider/Mantine.context.cjs');
require('../../../core/MantineProvider/default-theme.cjs');
require('../../../core/MantineProvider/MantineProvider.cjs');
require('../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../../core/MantineProvider/use-props/use-props.cjs');
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var Box = require('../../../core/Box/Box.cjs');
var factory = require('../../../core/factory/factory.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');
var Combobox_context = require('../Combobox.context.cjs');
var Combobox_module = require('../Combobox.module.css.cjs');

const defaultProps = {};
const ComboboxOptions = factory.factory((_props, ref) => {
  const props = useProps.useProps("ComboboxOptions", defaultProps, _props);
  const { classNames, className, style, styles, id, onMouseDown, labelledBy, ...others } = props;
  const ctx = Combobox_context.useComboboxContext();
  const _id = hooks.useId(id);
  React.useEffect(() => {
    ctx.store.setListId(_id);
  }, [_id]);
  return /* @__PURE__ */ jsxRuntime.jsx(
    Box.Box,
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
ComboboxOptions.classes = Combobox_module;
ComboboxOptions.displayName = "@mantine/core/ComboboxOptions";

exports.ComboboxOptions = ComboboxOptions;
//# sourceMappingURL=ComboboxOptions.cjs.map
