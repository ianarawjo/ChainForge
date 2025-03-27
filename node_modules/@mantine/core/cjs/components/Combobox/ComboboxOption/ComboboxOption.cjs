'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
require('@mantine/hooks');
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
const ComboboxOption = factory.factory((_props, ref) => {
  const props = useProps.useProps("ComboboxOption", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    vars,
    onClick,
    id,
    active,
    onMouseDown,
    onMouseOver,
    disabled,
    selected,
    mod,
    ...others
  } = props;
  const ctx = Combobox_context.useComboboxContext();
  const uuid = React.useId();
  const _id = id || uuid;
  return /* @__PURE__ */ jsxRuntime.jsx(
    Box.Box,
    {
      ...ctx.getStyles("option", { className, classNames, styles, style }),
      ...others,
      ref,
      id: _id,
      mod: [
        "combobox-option",
        { "combobox-active": active, "combobox-disabled": disabled, "combobox-selected": selected },
        mod
      ],
      role: "option",
      onClick: (event) => {
        if (!disabled) {
          ctx.onOptionSubmit?.(props.value, props);
          onClick?.(event);
        } else {
          event.preventDefault();
        }
      },
      onMouseDown: (event) => {
        event.preventDefault();
        onMouseDown?.(event);
      },
      onMouseOver: (event) => {
        if (ctx.resetSelectionOnOptionHover) {
          ctx.store.resetSelectedOption();
        }
        onMouseOver?.(event);
      }
    }
  );
});
ComboboxOption.classes = Combobox_module;
ComboboxOption.displayName = "@mantine/core/ComboboxOption";

exports.ComboboxOption = ComboboxOption;
//# sourceMappingURL=ComboboxOption.cjs.map
