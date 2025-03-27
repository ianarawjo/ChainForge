'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var hooks = require('@mantine/hooks');
var rem = require('../../../core/utils/units-converters/rem.cjs');
require('clsx');
require('../../../core/MantineProvider/Mantine.context.cjs');
require('../../../core/MantineProvider/default-theme.cjs');
require('../../../core/MantineProvider/MantineProvider.cjs');
var MantineThemeProvider = require('../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../../core/MantineProvider/use-props/use-props.cjs');
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var useStyles = require('../../../core/styles-api/use-styles/use-styles.cjs');
var Box = require('../../../core/Box/Box.cjs');
var factory = require('../../../core/factory/factory.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');
var ColorPicker_context = require('../ColorPicker.context.cjs');
var Thumb = require('../Thumb/Thumb.cjs');
var ColorPicker_module = require('../ColorPicker.module.css.cjs');

const defaultProps = {};
const ColorSlider = factory.factory((_props, ref) => {
  const props = useProps.useProps("ColorSlider", defaultProps, _props);
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
  const _getStyles = useStyles.useStyles({
    name: __staticSelector,
    classes: ColorPicker_module,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled
  });
  const ctxGetStyles = ColorPicker_context.useColorPickerContext()?.getStyles;
  const getStyles = ctxGetStyles || _getStyles;
  const theme = MantineThemeProvider.useMantineTheme();
  const [position, setPosition] = React.useState({ y: 0, x: value / maxValue });
  const positionRef = React.useRef(position);
  const getChangeValue = (val) => round ? Math.round(val * maxValue) : val * maxValue;
  const { ref: sliderRef } = hooks.useMove(
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
  hooks.useDidUpdate(() => {
    setPosition({ y: 0, x: value / maxValue });
  }, [value]);
  const handleArrow = (event, pos) => {
    event.preventDefault();
    const _position = hooks.clampUseMovePosition(pos);
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
  const layers = overlays.map((overlay, index) => /* @__PURE__ */ React.createElement("div", { ...getStyles("sliderOverlay"), style: overlay, key: index }));
  return /* @__PURE__ */ jsxRuntime.jsxs(
    Box.Box,
    {
      ...others,
      ref: hooks.useMergedRef(sliderRef, ref),
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
        /* @__PURE__ */ jsxRuntime.jsx(
          Thumb.Thumb,
          {
            position,
            ...getStyles("thumb", { style: { top: rem.rem(1), background: thumbColor } })
          }
        )
      ]
    }
  );
});
ColorSlider.displayName = "@mantine/core/ColorSlider";

exports.ColorSlider = ColorSlider;
//# sourceMappingURL=ColorSlider.cjs.map
