'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var hooks = require('@mantine/hooks');
var getSize = require('../../core/utils/get-size/get-size.cjs');
var createVarsResolver = require('../../core/styles-api/create-vars-resolver/create-vars-resolver.cjs');
require('clsx');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../core/MantineProvider/use-props/use-props.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var useStyles = require('../../core/styles-api/use-styles/use-styles.cjs');
var Box = require('../../core/Box/Box.cjs');
var factory = require('../../core/factory/factory.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
var ColorSwatch = require('../ColorSwatch/ColorSwatch.cjs');
var AlphaSlider = require('./AlphaSlider/AlphaSlider.cjs');
var ColorPicker_context = require('./ColorPicker.context.cjs');
var converters = require('./converters/converters.cjs');
var parsers = require('./converters/parsers.cjs');
var HueSlider = require('./HueSlider/HueSlider.cjs');
var Saturation = require('./Saturation/Saturation.cjs');
var Swatches = require('./Swatches/Swatches.cjs');
var ColorPicker_module = require('./ColorPicker.module.css.cjs');

const defaultProps = {
  swatchesPerRow: 7,
  withPicker: true,
  focusable: true,
  size: "md",
  __staticSelector: "ColorPicker"
};
const varsResolver = createVarsResolver.createVarsResolver((_, { size, swatchesPerRow }) => ({
  wrapper: {
    "--cp-preview-size": getSize.getSize(size, "cp-preview-size"),
    "--cp-width": getSize.getSize(size, "cp-width"),
    "--cp-body-spacing": getSize.getSpacing(size),
    "--cp-swatch-size": `${100 / swatchesPerRow}%`,
    "--cp-thumb-size": getSize.getSize(size, "cp-thumb-size"),
    "--cp-saturation-height": getSize.getSize(size, "cp-saturation-height")
  }
}));
const ColorPicker = factory.factory((_props, ref) => {
  const props = useProps.useProps("ColorPicker", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    format,
    value,
    defaultValue,
    onChange,
    onChangeEnd,
    withPicker,
    size,
    saturationLabel,
    hueLabel,
    alphaLabel,
    focusable,
    swatches,
    swatchesPerRow,
    fullWidth,
    onColorSwatchClick,
    __staticSelector,
    mod,
    ...others
  } = props;
  const getStyles = useStyles.useStyles({
    name: __staticSelector,
    props,
    classes: ColorPicker_module,
    className,
    style,
    classNames,
    styles,
    unstyled,
    rootSelector: "wrapper",
    vars,
    varsResolver
  });
  const formatRef = React.useRef(format);
  const valueRef = React.useRef("");
  const scrubTimeoutRef = React.useRef(-1);
  const isScrubbingRef = React.useRef(false);
  const withAlpha = format === "hexa" || format === "rgba" || format === "hsla";
  const [_value, setValue, controlled] = hooks.useUncontrolled({
    value,
    defaultValue,
    finalValue: "#FFFFFF",
    onChange
  });
  const [parsed, setParsed] = React.useState(parsers.parseColor(_value));
  const startScrubbing = () => {
    window.clearTimeout(scrubTimeoutRef.current);
    isScrubbingRef.current = true;
  };
  const stopScrubbing = () => {
    window.clearTimeout(scrubTimeoutRef.current);
    scrubTimeoutRef.current = window.setTimeout(() => {
      isScrubbingRef.current = false;
    }, 200);
  };
  const handleChange = (color) => {
    setParsed((current) => {
      const next = { ...current, ...color };
      valueRef.current = converters.convertHsvaTo(formatRef.current, next);
      return next;
    });
    setValue(valueRef.current);
  };
  hooks.useDidUpdate(() => {
    if (parsers.isColorValid(value) && !isScrubbingRef.current) {
      setParsed(parsers.parseColor(value));
    }
  }, [value]);
  hooks.useDidUpdate(() => {
    formatRef.current = format;
    setValue(converters.convertHsvaTo(format, parsed));
  }, [format]);
  return /* @__PURE__ */ jsxRuntime.jsx(ColorPicker_context.ColorPickerProvider, { value: { getStyles, unstyled }, children: /* @__PURE__ */ jsxRuntime.jsxs(
    Box.Box,
    {
      ref,
      ...getStyles("wrapper"),
      size,
      mod: [{ "full-width": fullWidth }, mod],
      ...others,
      children: [
        withPicker && /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
          /* @__PURE__ */ jsxRuntime.jsx(
            Saturation.Saturation,
            {
              value: parsed,
              onChange: handleChange,
              onChangeEnd: ({ s, v }) => onChangeEnd?.(converters.convertHsvaTo(formatRef.current, { ...parsed, s, v })),
              color: _value,
              size,
              focusable,
              saturationLabel,
              onScrubStart: startScrubbing,
              onScrubEnd: stopScrubbing
            }
          ),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { ...getStyles("body"), children: [
            /* @__PURE__ */ jsxRuntime.jsxs("div", { ...getStyles("sliders"), children: [
              /* @__PURE__ */ jsxRuntime.jsx(
                HueSlider.HueSlider,
                {
                  value: parsed.h,
                  onChange: (h) => handleChange({ h }),
                  onChangeEnd: (h) => onChangeEnd?.(converters.convertHsvaTo(formatRef.current, { ...parsed, h })),
                  size,
                  focusable,
                  "aria-label": hueLabel,
                  onScrubStart: startScrubbing,
                  onScrubEnd: stopScrubbing
                }
              ),
              withAlpha && /* @__PURE__ */ jsxRuntime.jsx(
                AlphaSlider.AlphaSlider,
                {
                  value: parsed.a,
                  onChange: (a) => handleChange({ a }),
                  onChangeEnd: (a) => {
                    onChangeEnd?.(converters.convertHsvaTo(formatRef.current, { ...parsed, a }));
                  },
                  size,
                  color: converters.convertHsvaTo("hex", parsed),
                  focusable,
                  "aria-label": alphaLabel,
                  onScrubStart: startScrubbing,
                  onScrubEnd: stopScrubbing
                }
              )
            ] }),
            withAlpha && /* @__PURE__ */ jsxRuntime.jsx(
              ColorSwatch.ColorSwatch,
              {
                color: _value,
                radius: "sm",
                size: "var(--cp-preview-size)",
                ...getStyles("preview")
              }
            )
          ] })
        ] }),
        Array.isArray(swatches) && /* @__PURE__ */ jsxRuntime.jsx(
          Swatches.Swatches,
          {
            data: swatches,
            swatchesPerRow,
            focusable,
            setValue,
            onChangeEnd: (color) => {
              const convertedColor = converters.convertHsvaTo(format, parsers.parseColor(color));
              onColorSwatchClick?.(convertedColor);
              onChangeEnd?.(convertedColor);
              if (!controlled) {
                setParsed(parsers.parseColor(color));
              }
            }
          }
        )
      ]
    }
  ) });
});
ColorPicker.classes = ColorPicker_module;
ColorPicker.displayName = "@mantine/core/ColorPicker";

exports.ColorPicker = ColorPicker;
//# sourceMappingURL=ColorPicker.cjs.map
