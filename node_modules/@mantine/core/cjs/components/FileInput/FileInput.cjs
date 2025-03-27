'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var hooks = require('@mantine/hooks');
require('clsx');
var useResolvedStylesApi = require('../../core/styles-api/use-resolved-styles-api/use-resolved-styles-api.cjs');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../core/MantineProvider/use-props/use-props.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
require('../../core/Box/Box.cjs');
var factory = require('../../core/factory/factory.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
require('../CloseButton/CloseIcon.cjs');
var CloseButton = require('../CloseButton/CloseButton.cjs');
var FileButton = require('../FileButton/FileButton.cjs');
var Input = require('../Input/Input.cjs');
require('../Input/InputWrapper/InputWrapper.cjs');
require('../Input/InputDescription/InputDescription.cjs');
require('../Input/InputError/InputError.cjs');
require('../Input/InputLabel/InputLabel.cjs');
require('../Input/InputPlaceholder/InputPlaceholder.cjs');
require('../Input/InputClearButton/InputClearButton.cjs');
require('../Input/InputWrapper.context.cjs');
var InputBase = require('../InputBase/InputBase.cjs');

const DefaultValue = ({ value }) => /* @__PURE__ */ jsxRuntime.jsx("div", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: Array.isArray(value) ? value.map((file) => file.name).join(", ") : value?.name });
const defaultProps = {
  valueComponent: DefaultValue
};
const _FileInput = factory.factory((_props, ref) => {
  const props = useProps.useProps("FileInput", defaultProps, _props);
  const {
    unstyled,
    vars,
    onChange,
    value,
    defaultValue,
    multiple,
    accept,
    name,
    form,
    valueComponent,
    clearable,
    clearButtonProps,
    readOnly,
    capture,
    fileInputProps,
    rightSection,
    size,
    placeholder,
    component,
    resetRef: resetRefProp,
    classNames,
    styles,
    ...others
  } = props;
  const resetRef = React.useRef(null);
  const { resolvedClassNames, resolvedStyles } = useResolvedStylesApi.useResolvedStylesApi({
    classNames,
    styles,
    props
  });
  const [_value, setValue] = hooks.useUncontrolled({
    value,
    defaultValue,
    onChange,
    finalValue: multiple ? [] : null
  });
  const hasValue = Array.isArray(_value) ? _value.length !== 0 : _value !== null;
  const _rightSection = rightSection || (clearable && hasValue && !readOnly ? /* @__PURE__ */ jsxRuntime.jsx(
    CloseButton.CloseButton,
    {
      ...clearButtonProps,
      variant: "subtle",
      onClick: () => setValue(multiple ? [] : null),
      size,
      unstyled
    }
  ) : null);
  React.useEffect(() => {
    if (Array.isArray(_value) && _value.length === 0 || _value === null) {
      resetRef.current?.();
    }
  }, [_value]);
  const ValueComponent = valueComponent;
  return /* @__PURE__ */ jsxRuntime.jsx(
    FileButton.FileButton,
    {
      onChange: setValue,
      multiple,
      accept,
      name,
      form,
      resetRef: hooks.useMergedRef(resetRef, resetRefProp),
      disabled: readOnly,
      capture,
      inputProps: fileInputProps,
      children: (fileButtonProps) => /* @__PURE__ */ jsxRuntime.jsx(
        InputBase.InputBase,
        {
          component: component || "button",
          ref,
          rightSection: _rightSection,
          ...fileButtonProps,
          ...others,
          __staticSelector: "FileInput",
          multiline: true,
          type: "button",
          pointer: true,
          __stylesApiProps: props,
          unstyled,
          size,
          classNames,
          styles,
          children: !hasValue ? /* @__PURE__ */ jsxRuntime.jsx(
            Input.Input.Placeholder,
            {
              __staticSelector: "FileInput",
              classNames: resolvedClassNames,
              styles: resolvedStyles,
              children: placeholder
            }
          ) : /* @__PURE__ */ jsxRuntime.jsx(ValueComponent, { value: _value })
        }
      )
    }
  );
});
_FileInput.classes = InputBase.InputBase.classes;
_FileInput.displayName = "@mantine/core/FileInput";
const FileInput = _FileInput;

exports.FileInput = FileInput;
//# sourceMappingURL=FileInput.cjs.map
