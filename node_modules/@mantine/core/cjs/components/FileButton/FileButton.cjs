'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var hooks = require('@mantine/hooks');
require('clsx');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../core/MantineProvider/use-props/use-props.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
require('../../core/Box/Box.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');

const defaultProps = {
  multiple: false
};
const FileButton = React.forwardRef(
  (props, ref) => {
    const {
      onChange,
      children,
      multiple,
      accept,
      name,
      form,
      resetRef,
      disabled,
      capture,
      inputProps,
      ...others
    } = useProps.useProps("FileButton", defaultProps, props);
    const inputRef = React.useRef(null);
    const onClick = () => {
      !disabled && inputRef.current?.click();
    };
    const handleChange = (event) => {
      if (multiple) {
        onChange(Array.from(event.currentTarget.files));
      } else {
        onChange(event.currentTarget.files[0] || null);
      }
    };
    const reset = () => {
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    };
    hooks.assignRef(resetRef, reset);
    return /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
      children({ onClick, ...others }),
      /* @__PURE__ */ jsxRuntime.jsx(
        "input",
        {
          style: { display: "none" },
          type: "file",
          accept,
          multiple,
          onChange: handleChange,
          ref: hooks.useMergedRef(ref, inputRef),
          name,
          form,
          capture,
          ...inputProps
        }
      )
    ] });
  }
);
FileButton.displayName = "@mantine/core/FileButton";

exports.FileButton = FileButton;
//# sourceMappingURL=FileButton.cjs.map
