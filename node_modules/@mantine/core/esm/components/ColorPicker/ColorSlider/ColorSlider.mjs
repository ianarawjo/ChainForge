'use client';
import { jsxs, jsx } from 'react/jsx-runtime';
import { useState, useRef, createElement } from 'react';
import { useMove, useDidUpdate, useMergedRef, clampUseMovePosition } from '@mantine/hooks';
import { rem } from '../../../core/utils/units-converters/rem.mjs';
import 'clsx';
import '../../../core/MantineProvider/Mantine.context.mjs';
import '../../../core/MantineProvider/default-theme.mjs';
import '../../../core/MantineProvider/MantineProvider.mjs';
import { useMantineTheme } from '../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../../core/MantineProvider/use-props/use-props.mjs';
import '../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { useStyles } from '../../../core/styles-api/use-styles/use-styles.mjs';
import { Box } from '../../../core/Box/Box.mjs';
import { factory } from '../../../core/factory/factory.mjs';
import '../../../core/DirectionProvider/DirectionProvider.mjs';
import { useColorPickerContext } from '../ColorPicker.context.mjs';
import { Thumb } from '../Thumb/Thumb.mjs';
import classes from '../ColorPicker.module.css.mjs';

const defaultProps = {};
const ColorSlider = factory((_props, ref) => {
  const props = useProps("ColorSlider", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    onChange,
    onChangeEnd,
    maxValue,
    round,
    size = "md",
    focusable = true,
    value,
    overlays,
    thumbColor = "transparent",
    onScrubStart,
    onScrubEnd,
    __staticSelector = "ColorPicker",
    ...others
  } = props;
  const _getStyles = useStyles({
    name: __staticSelector,
    classes,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled
  });
  const ctxGetStyles = useColorPickerContext()?.getStyles;
  const getStyles = ctxGetStyles || _getStyles;
  const theme = useMantineTheme();
  const [position, setPosition] = useState({ y: 0, x: value / maxValue });
  const positionRef = useRef(position);
  const getChangeValue = (val) => round ? Math.round(val * maxValue) : val * maxValue;
  const { ref: sliderRef } = useMove(
    ({ x, y }) => {
      positionRef.current = { x, y };
      onChange?.(getChangeValue(x));
    },
    {
      onScrubEnd: () => {
        const { x } = positionRef.current;
        onChangeEnd?.(getChangeValue(x));
        onScrubEnd?.();
      },
      onScrubStart
    }
  );
  useDidUpdate(() => {
    setPosition({ y: 0, x: value / maxValue });
  }, [value]);
  const handleArrow = (event, pos) => {
    event.preventDefault();
    const _position = clampUseMovePosition(pos);
    onChange?.(getChangeValue(_position.x));
    onChangeEnd?.(getChangeValue(_position.x));
  };
  const handleKeyDown = (event) => {
    switch (event.key) {
      case "ArrowRight": {
        handleArrow(event, { x: position.x + 0.05, y: position.y });
        break;
      }
      case "ArrowLeft": {
        handleArrow(event, { x: position.x - 0.05, y: position.y });
        break;
      }
    }
  };
  const layers = overlays.map((overlay, index) => /* @__PURE__ */ createElement("div", { ...getStyles("sliderOverlay"), style: overlay, key: index }));
  return /* @__PURE__ */ jsxs(
    Box,
    {
      ...others,
      ref: useMergedRef(sliderRef, ref),
      ...getStyles("slider"),
      role: "slider",
      "aria-valuenow": value,
      "aria-valuemax": maxValue,
      "aria-valuemin": 0,
      tabIndex: focusable ? 0 : -1,
      onKeyDown: handleKeyDown,
      "data-focus-ring": theme.focusRing,
      __vars: {
        "--cp-thumb-size": `var(--cp-thumb-size-${size})`
      },
      children: [
        layers,
        /* @__PURE__ */ jsx(
          Thumb,
          {
            position,
            ...getStyles("thumb", { style: { top: rem(1), background: thumbColor } })
          }
        )
      ]
    }
  );
});
ColorSlider.displayName = "@mantine/core/ColorSlider";

export { ColorSlider };
//# sourceMappingURL=ColorSlider.mjs.map
