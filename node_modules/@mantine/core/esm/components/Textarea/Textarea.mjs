'use client';
import { jsx } from 'react/jsx-runtime';
import TextareaAutosize from 'react-textarea-autosize';
import 'react';
import '@mantine/hooks';
import { getEnv } from '../../core/utils/get-env/get-env.mjs';
import 'clsx';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../core/MantineProvider/use-props/use-props.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../core/Box/Box.mjs';
import { factory } from '../../core/factory/factory.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import { InputBase } from '../InputBase/InputBase.mjs';

const defaultProps = {};
const Textarea = factory((props, ref) => {
  const { autosize, maxRows, minRows, __staticSelector, resize, ...others } = useProps(
    "Textarea",
    defaultProps,
    props
  );
  const shouldAutosize = autosize && getEnv() !== "test";
  const autosizeProps = shouldAutosize ? { maxRows, minRows } : {};
  return /* @__PURE__ */ jsx(
    InputBase,
    {
      component: shouldAutosize ? TextareaAutosize : "textarea",
      ref,
      ...others,
      __staticSelector: __staticSelector || "Textarea",
      multiline: true,
      "data-no-overflow": autosize && maxRows === void 0 || void 0,
      __vars: { "--input-resize": resize },
      ...autosizeProps
    }
  );
});
Textarea.classes = InputBase.classes;
Textarea.displayName = "@mantine/core/Textarea";

export { Textarea };
//# sourceMappingURL=Textarea.mjs.map
