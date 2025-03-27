'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var getSize = require('../../core/utils/get-size/get-size.cjs');
require('@mantine/hooks');
require('clsx');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var useStyles = require('../../core/styles-api/use-styles/use-styles.cjs');
var Box = require('../../core/Box/Box.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
var Input = require('../Input/Input.cjs');
require('../Input/InputWrapper/InputWrapper.cjs');
require('../Input/InputDescription/InputDescription.cjs');
require('../Input/InputError/InputError.cjs');
require('../Input/InputLabel/InputLabel.cjs');
require('../Input/InputPlaceholder/InputPlaceholder.cjs');
require('../Input/InputClearButton/InputClearButton.cjs');
require('../Input/InputWrapper.context.cjs');
var InlineInput_module = require('./InlineInput.module.css.cjs');

const InlineInputClasses = InlineInput_module;
const InlineInput = React.forwardRef(
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
    const getStyles = useStyles.useStyles({
      name: __staticSelector,
      props: __stylesApiProps,
      className,
      style,
      classes: InlineInput_module,
      classNames,
      styles,
      unstyled
    });
    return /* @__PURE__ */ jsxRuntime.jsx(
      Box.Box,
      {
        ...getStyles("root"),
        ref,
        __vars: {
          "--label-fz": getSize.getFontSize(size),
          "--label-lh": getSize.getSize(size, "label-lh")
        },
        mod: [{ "label-position": labelPosition }, mod],
        variant,
        size,
        ...others,
        children: /* @__PURE__ */ jsxRuntime.jsxs(
          Box.Box,
          {
            component: bodyElement,
            htmlFor: bodyElement === "label" ? id : void 0,
            ...getStyles("body"),
            children: [
              children,
              /* @__PURE__ */ jsxRuntime.jsxs("div", { ...getStyles("labelWrapper"), "data-disabled": disabled || void 0, children: [
                label && /* @__PURE__ */ jsxRuntime.jsx(
                  Box.Box,
                  {
                    component: labelElement,
                    htmlFor: labelElement === "label" ? id : void 0,
                    ...getStyles("label"),
                    "data-disabled": disabled || void 0,
                    children: label
                  }
                ),
                description && /* @__PURE__ */ jsxRuntime.jsx(Input.Input.Description, { size, __inheritStyles: false, ...getStyles("description"), children: description }),
                error && typeof error !== "boolean" && /* @__PURE__ */ jsxRuntime.jsx(Input.Input.Error, { size, __inheritStyles: false, ...getStyles("error"), children: error })
              ] })
            ]
          }
        )
      }
    );
  }
);
InlineInput.displayName = "@mantine/core/InlineInput";

exports.InlineInput = InlineInput;
exports.InlineInputClasses = InlineInputClasses;
//# sourceMappingURL=InlineInput.cjs.map
