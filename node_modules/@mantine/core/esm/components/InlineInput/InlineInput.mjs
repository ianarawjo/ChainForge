'use client';
import { jsx, jsxs } from 'react/jsx-runtime';
import { forwardRef } from 'react';
import { getFontSize, getSize } from '../../core/utils/get-size/get-size.mjs';
import '@mantine/hooks';
import 'clsx';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { useStyles } from '../../core/styles-api/use-styles/use-styles.mjs';
import { Box } from '../../core/Box/Box.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import { Input } from '../Input/Input.mjs';
import '../Input/InputWrapper/InputWrapper.mjs';
import '../Input/InputDescription/InputDescription.mjs';
import '../Input/InputError/InputError.mjs';
import '../Input/InputLabel/InputLabel.mjs';
import '../Input/InputPlaceholder/InputPlaceholder.mjs';
import '../Input/InputClearButton/InputClearButton.mjs';
import '../Input/InputWrapper.context.mjs';
import classes from './InlineInput.module.css.mjs';

const InlineInputClasses = classes;
const InlineInput = forwardRef(
  ({
    __staticSelector,
    __stylesApiProps,
    className,
    classNames,
    styles,
    unstyled,
    children,
    label,
    description,
    id,
    disabled,
    error,
    size,
    labelPosition = "left",
    bodyElement = "div",
    labelElement = "label",
    variant,
    style,
    vars,
    mod,
    ...others
  }, ref) => {
    const getStyles = useStyles({
      name: __staticSelector,
      props: __stylesApiProps,
      className,
      style,
      classes,
      classNames,
      styles,
      unstyled
    });
    return /* @__PURE__ */ jsx(
      Box,
      {
        ...getStyles("root"),
        ref,
        __vars: {
          "--label-fz": getFontSize(size),
          "--label-lh": getSize(size, "label-lh")
        },
        mod: [{ "label-position": labelPosition }, mod],
        variant,
        size,
        ...others,
        children: /* @__PURE__ */ jsxs(
          Box,
          {
            component: bodyElement,
            htmlFor: bodyElement === "label" ? id : void 0,
            ...getStyles("body"),
            children: [
              children,
              /* @__PURE__ */ jsxs("div", { ...getStyles("labelWrapper"), "data-disabled": disabled || void 0, children: [
                label && /* @__PURE__ */ jsx(
                  Box,
                  {
                    component: labelElement,
                    htmlFor: labelElement === "label" ? id : void 0,
                    ...getStyles("label"),
                    "data-disabled": disabled || void 0,
                    children: label
                  }
                ),
                description && /* @__PURE__ */ jsx(Input.Description, { size, __inheritStyles: false, ...getStyles("description"), children: description }),
                error && typeof error !== "boolean" && /* @__PURE__ */ jsx(Input.Error, { size, __inheritStyles: false, ...getStyles("error"), children: error })
              ] })
            ]
          }
        )
      }
    );
  }
);
InlineInput.displayName = "@mantine/core/InlineInput";

export { InlineInput, InlineInputClasses };
//# sourceMappingURL=InlineInput.mjs.map
