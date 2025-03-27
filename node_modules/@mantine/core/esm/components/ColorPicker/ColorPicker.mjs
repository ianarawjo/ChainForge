'use client';
import { jsx, jsxs, Fragment } from 'react/jsx-runtime';
import { useRef, useState } from 'react';
import { useUncontrolled, useDidUpdate } from '@mantine/hooks';
import { getSize, getSpacing } from '../../core/utils/get-size/get-size.mjs';
import { createVarsResolver } from '../../core/styles-api/create-vars-resolver/create-vars-resolver.mjs';
import 'clsx';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../core/MantineProvider/use-props/use-props.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { useStyles } from '../../core/styles-api/use-styles/use-styles.mjs';
import { Box } from '../../core/Box/Box.mjs';
import { factory } from '../../core/factory/factory.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import { ColorSwatch } from '../ColorSwatch/ColorSwatch.mjs';
import { AlphaSlider } from './AlphaSlider/AlphaSlider.mjs';
import { ColorPickerProvider } from './ColorPicker.context.mjs';
import { convertHsvaTo } from './converters/converters.mjs';
import { parseColor, isColorValid } from './converters/parsers.mjs';
import { HueSlider } from './HueSlider/HueSlider.mjs';
import { Saturation } from './Saturation/Saturation.mjs';
import { Swatches } from './Swatches/Swatches.mjs';
import classes from './ColorPicker.module.css.mjs';

const defaultProps = {
  swatchesPerRow: 7,
  withPicker: true,
  focusable: true,
  size: "md",
  __staticSelector: "ColorPicker"
};
const varsResolver = createVarsResolver((_, { size, swatchesPerRow }) => ({
  wrapper: {
    "--cp-preview-size": getSize(size, "cp-preview-size"),
    "--cp-width": getSize(size, "cp-width"),
    "--cp-body-spacing": getSpacing(size),
    "--cp-swatch-size": `${100 / swatchesPerRow}%`,
    "--cp-thumb-size": getSize(size, "cp-thumb-size"),
    "--cp-saturation-height": getSize(size, "cp-saturation-height")
  }
}));
const ColorPicker = factory((_props, ref) => {
  const props = useProps("ColorPicker", defaultProps, _props);
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
  const getStyles = useStyles({
    name: __staticSelector,
    props,
    classes,
    className,
    style,
    classNames,
    styles,
    unstyled,
    rootSelector: "wrapper",
    vars,
    varsResolver
  });
  const formatRef = useRef(format);
  const valueRef = useRef("");
  const scrubTimeoutRef = useRef(-1);
  const isScrubbingRef = useRef(false);
  const withAlpha = format === "hexa" || format === "rgba" || format === "hsla";
  const [_value, setValue, controlled] = useUncontrolled({
    value,
    defaultValue,
    finalValue: "#FFFFFF",
    onChange
  });
  const [parsed, setParsed] = useState(parseColor(_value));
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
      valueRef.current = convertHsvaTo(formatRef.current, next);
      return next;
    });
    setValue(valueRef.current);
  };
  useDidUpdate(() => {
    if (isColorValid(value) && !isScrubbingRef.current) {
      setParsed(parseColor(value));
    }
  }, [value]);
  useDidUpdate(() => {
    formatRef.current = format;
    setValue(convertHsvaTo(format, parsed));
  }, [format]);
  return /* @__PURE__ */ jsx(ColorPickerProvider, { value: { getStyles, unstyled }, children: /* @__PURE__ */ jsxs(
    Box,
    {
      ref,
      ...getStyles("wrapper"),
      size,
      mod: [{ "full-width": fullWidth }, mod],
      ...others,
      children: [
        withPicker && /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx(
            Saturation,
            {
              value: parsed,
              onChange: handleChange,
              onChangeEnd: ({ s, v }) => onChangeEnd?.(convertHsvaTo(formatRef.current, { ...parsed, s, v })),
              color: _value,
              size,
              focusable,
              saturationLabel,
              onScrubStart: startScrubbing,
              onScrubEnd: stopScrubbing
            }
          ),
          /* @__PURE__ */ jsxs("div", { ...getStyles("body"), children: [
            /* @__PURE__ */ jsxs("div", { ...getStyles("sliders"), children: [
              /* @__PURE__ */ jsx(
                HueSlider,
                {
                  value: parsed.h,
                  onChange: (h) => handleChange({ h }),
                  onChangeEnd: (h) => onChangeEnd?.(convertHsvaTo(formatRef.current, { ...parsed, h })),
                  size,
                  focusable,
                  "aria-label": hueLabel,
                  onScrubStart: startScrubbing,
                  onScrubEnd: stopScrubbing
                }
              ),
              withAlpha && /* @__PURE__ */ jsx(
                AlphaSlider,
                {
                  value: parsed.a,
                  onChange: (a) => handleChange({ a }),
                  onChangeEnd: (a) => {
                    onChangeEnd?.(convertHsvaTo(formatRef.current, { ...parsed, a }));
                  },
                  size,
                  color: convertHsvaTo("hex", parsed),
                  focusable,
                  "aria-label": alphaLabel,
                  onScrubStart: startScrubbing,
                  onScrubEnd: stopScrubbing
                }
              )
            ] }),
            withAlpha && /* @__PURE__ */ jsx(
              ColorSwatch,
              {
                color: _value,
                radius: "sm",
                size: "var(--cp-preview-size)",
                ...getStyles("preview")
              }
            )
          ] })
        ] }),
        Array.isArray(swatches) && /* @__PURE__ */ jsx(
          Swatches,
          {
            data: swatches,
            swatchesPerRow,
            focusable,
            setValue,
            onChangeEnd: (color) => {
              const convertedColor = convertHsvaTo(format, parseColor(color));
              onColorSwatchClick?.(convertedColor);
              onChangeEnd?.(convertedColor);
              if (!controlled) {
                setParsed(parseColor(color));
              }
            }
          }
        )
      ]
    }
  ) });
});
ColorPicker.classes = classes;
ColorPicker.displayName = "@mantine/core/ColorPicker";

export { ColorPicker };
//# sourceMappingURL=ColorPicker.mjs.map
