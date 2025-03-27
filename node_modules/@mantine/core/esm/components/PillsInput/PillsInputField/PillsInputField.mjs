'use client';
import { jsx } from 'react/jsx-runtime';
import { useMergedRef } from '@mantine/hooks';
import 'react';
import 'clsx';
import '../../../core/MantineProvider/Mantine.context.mjs';
import '../../../core/MantineProvider/default-theme.mjs';
import '../../../core/MantineProvider/MantineProvider.mjs';
import '../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../../core/MantineProvider/use-props/use-props.mjs';
import '../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { useStyles } from '../../../core/styles-api/use-styles/use-styles.mjs';
import { Box } from '../../../core/Box/Box.mjs';
import { factory } from '../../../core/factory/factory.mjs';
import '../../../core/DirectionProvider/DirectionProvider.mjs';
import '../../Input/Input.mjs';
import '../../Input/InputWrapper/InputWrapper.mjs';
import '../../Input/InputDescription/InputDescription.mjs';
import '../../Input/InputError/InputError.mjs';
import '../../Input/InputLabel/InputLabel.mjs';
import '../../Input/InputPlaceholder/InputPlaceholder.mjs';
import '../../Input/InputClearButton/InputClearButton.mjs';
import { useInputWrapperContext } from '../../Input/InputWrapper.context.mjs';
import { usePillsInputContext } from '../PillsInput.context.mjs';
import classes from '../PillsInput.module.css.mjs';

const defaultProps = {
  type: "visible"
};
const PillsInputField = factory((_props, ref) => {
  const props = useProps("PillsInputField", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    type,
    disabled,
    id,
    pointer,
    mod,
    ...others
  } = props;
  const ctx = usePillsInputContext();
  const inputWrapperCtx = useInputWrapperContext();
  const getStyles = useStyles({
    name: "PillsInputField",
    classes,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    rootSelector: "field"
  });
  const _disabled = disabled || ctx?.disabled;
  return /* @__PURE__ */ jsx(
    Box,
    {
      component: "input",
      ref: useMergedRef(ref, ctx?.fieldRef),
      "data-type": type,
      disabled: _disabled,
      mod: [{ disabled: _disabled, pointer }, mod],
      ...getStyles("field"),
      ...others,
      id: inputWrapperCtx?.inputId || id,
      "aria-invalid": ctx?.hasError,
      "aria-describedby": inputWrapperCtx?.describedBy,
      type: "text",
      onMouseDown: (event) => !pointer && event.stopPropagation()
    }
  );
});
PillsInputField.classes = classes;
PillsInputField.displayName = "@mantine/core/PillsInputField";

export { PillsInputField };
//# sourceMappingURL=PillsInputField.mjs.map
