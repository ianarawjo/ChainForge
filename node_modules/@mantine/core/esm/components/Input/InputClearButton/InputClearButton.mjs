'use client';
import { jsx } from 'react/jsx-runtime';
import 'react';
import '@mantine/hooks';
import 'clsx';
import { useResolvedStylesApi } from '../../../core/styles-api/use-resolved-styles-api/use-resolved-styles-api.mjs';
import '../../../core/MantineProvider/Mantine.context.mjs';
import '../../../core/MantineProvider/default-theme.mjs';
import '../../../core/MantineProvider/MantineProvider.mjs';
import '../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../../core/MantineProvider/use-props/use-props.mjs';
import '../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../../core/Box/Box.mjs';
import { factory } from '../../../core/factory/factory.mjs';
import '../../../core/DirectionProvider/DirectionProvider.mjs';
import '../../CloseButton/CloseIcon.mjs';
import { CloseButton } from '../../CloseButton/CloseButton.mjs';
import { useInputContext } from '../Input.context.mjs';

const defaultProps = {};
const InputClearButton = factory((_props, ref) => {
  const props = useProps("InputClearButton", defaultProps, _props);
  const { size, variant, vars, classNames, styles, ...others } = props;
  const ctx = useInputContext();
  const { resolvedClassNames, resolvedStyles } = useResolvedStylesApi({
    classNames,
    styles,
    props
  });
  return /* @__PURE__ */ jsx(
    CloseButton,
    {
      variant: variant || "transparent",
      ref,
      size: size || ctx?.size || "sm",
      classNames: resolvedClassNames,
      styles: resolvedStyles,
      __staticSelector: "InputClearButton",
      ...others
    }
  );
});
InputClearButton.displayName = "@mantine/core/InputClearButton";

export { InputClearButton };
//# sourceMappingURL=InputClearButton.mjs.map
