'use client';
import { jsx } from 'react/jsx-runtime';
import { useRef, useEffect } from 'react';
import { useUncontrolled, useMergedRef } from '@mantine/hooks';
import 'clsx';
import { useResolvedStylesApi } from '../../core/styles-api/use-resolved-styles-api/use-resolved-styles-api.mjs';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../core/MantineProvider/use-props/use-props.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../core/Box/Box.mjs';
import { factory } from '../../core/factory/factory.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import '../CloseButton/CloseIcon.mjs';
import { CloseButton } from '../CloseButton/CloseButton.mjs';
import { FileButton } from '../FileButton/FileButton.mjs';
import { Input } from '../Input/Input.mjs';
import '../Input/InputWrapper/InputWrapper.mjs';
import '../Input/InputDescription/InputDescription.mjs';
import '../Input/InputError/InputError.mjs';
import '../Input/InputLabel/InputLabel.mjs';
import '../Input/InputPlaceholder/InputPlaceholder.mjs';
import '../Input/InputClearButton/InputClearButton.mjs';
import '../Input/InputWrapper.context.mjs';
import { InputBase } from '../InputBase/InputBase.mjs';

const DefaultValue = ({ value }) => /* @__PURE__ */ jsx("div", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: Array.isArray(value) ? value.map((file) => file.name).join(", ") : value?.name });
const defaultProps = {
  valueComponent: DefaultValue
};
const _FileInput = factory((_props, ref) => {
  const props = useProps("FileInput", defaultProps, _props);
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
  const resetRef = useRef(null);
  const { resolvedClassNames, resolvedStyles } = useResolvedStylesApi({
    classNames,
    styles,
    props
  });
  const [_value, setValue] = useUncontrolled({
    value,
    defaultValue,
    onChange,
    finalValue: multiple ? [] : null
  });
  const hasValue = Array.isArray(_value) ? _value.length !== 0 : _value !== null;
  const _rightSection = rightSection || (clearable && hasValue && !readOnly ? /* @__PURE__ */ jsx(
    CloseButton,
    {
      ...clearButtonProps,
      variant: "subtle",
      onClick: () => setValue(multiple ? [] : null),
      size,
      unstyled
    }
  ) : null);
  useEffect(() => {
    if (Array.isArray(_value) && _value.length === 0 || _value === null) {
      resetRef.current?.();
    }
  }, [_value]);
  const ValueComponent = valueComponent;
  return /* @__PURE__ */ jsx(
    FileButton,
    {
      onChange: setValue,
      multiple,
      accept,
      name,
      form,
      resetRef: useMergedRef(resetRef, resetRefProp),
      disabled: readOnly,
      capture,
      inputProps: fileInputProps,
      children: (fileButtonProps) => /* @__PURE__ */ jsx(
        InputBase,
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
          children: !hasValue ? /* @__PURE__ */ jsx(
            Input.Placeholder,
            {
              __staticSelector: "FileInput",
              classNames: resolvedClassNames,
              styles: resolvedStyles,
              children: placeholder
            }
          ) : /* @__PURE__ */ jsx(ValueComponent, { value: _value })
        }
      )
    }
  );
});
_FileInput.classes = InputBase.classes;
_FileInput.displayName = "@mantine/core/FileInput";
const FileInput = _FileInput;

export { FileInput };
//# sourceMappingURL=FileInput.mjs.map
