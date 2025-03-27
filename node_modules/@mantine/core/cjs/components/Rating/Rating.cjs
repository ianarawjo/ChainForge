'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var hooks = require('@mantine/hooks');
var getSize = require('../../core/utils/get-size/get-size.cjs');
var createVarsResolver = require('../../core/styles-api/create-vars-resolver/create-vars-resolver.cjs');
require('clsx');
var getThemeColor = require('../../core/MantineProvider/color-functions/get-theme-color/get-theme-color.cjs');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../core/MantineProvider/use-props/use-props.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var useStyles = require('../../core/styles-api/use-styles/use-styles.cjs');
var Box = require('../../core/Box/Box.cjs');
var factory = require('../../core/factory/factory.cjs');
var DirectionProvider = require('../../core/DirectionProvider/DirectionProvider.cjs');
var Rating_context = require('./Rating.context.cjs');
var RatingItem = require('./RatingItem/RatingItem.cjs');
var Rating_module = require('./Rating.module.css.cjs');

function roundValueTo(value, to) {
  const rounded = Math.round(value / to) * to;
  const precision = `${to}`.split(".")[1]?.length || 0;
  return Number(rounded.toFixed(precision));
}
const defaultProps = {
  size: "sm",
  getSymbolLabel: (value) => `${value}`,
  count: 5,
  fractions: 1,
  color: "yellow"
};
const varsResolver = createVarsResolver.createVarsResolver((theme, { size, color }) => ({
  root: {
    "--rating-size": getSize.getSize(size, "rating-size"),
    "--rating-color": getThemeColor.getThemeColor(color, theme)
  }
}));
const Rating = factory.factory((_props, ref) => {
  const props = useProps.useProps("Rating", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    name,
    id,
    value,
    defaultValue,
    onChange,
    fractions,
    count,
    onMouseEnter,
    readOnly,
    onMouseMove,
    onHover,
    onMouseLeave,
    onTouchStart,
    onTouchEnd,
    size,
    variant,
    getSymbolLabel,
    color,
    emptySymbol,
    fullSymbol,
    highlightSelectedOnly,
    ...others
  } = props;
  const getStyles = useStyles.useStyles({
    name: "Rating",
    classes: Rating_module,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  const { dir } = DirectionProvider.useDirection();
  const _name = hooks.useId(name);
  const _id = hooks.useId(id);
  const rootRef = React.useRef(null);
  const [_value, setValue] = hooks.useUncontrolled({
    value,
    defaultValue,
    finalValue: 0,
    onChange
  });
  const [hovered, setHovered] = React.useState(-1);
  const [isOutside, setOutside] = React.useState(true);
  const _fractions = Math.floor(fractions);
  const _count = Math.floor(count);
  const decimalUnit = 1 / _fractions;
  const stableValueRounded = roundValueTo(_value, decimalUnit);
  const finalValue = hovered !== -1 ? hovered : stableValueRounded;
  const getRatingFromCoordinates = (x) => {
    const { left, right, width } = rootRef.current.getBoundingClientRect();
    const symbolWidth = width / _count;
    const hoverPosition = dir === "rtl" ? right - x : x - left;
    const hoverValue = hoverPosition / symbolWidth;
    return hooks.clamp(roundValueTo(hoverValue + decimalUnit / 2, decimalUnit), decimalUnit, _count);
  };
  const handleMouseEnter = (event) => {
    onMouseEnter?.(event);
    !readOnly && setOutside(false);
  };
  const handleMouseMove = (event) => {
    onMouseMove?.(event);
    if (readOnly) {
      return;
    }
    const rounded = getRatingFromCoordinates(event.clientX);
    setHovered(rounded);
    rounded !== hovered && onHover?.(rounded);
  };
  const handleMouseLeave = (event) => {
    onMouseLeave?.(event);
    if (readOnly) {
      return;
    }
    setHovered(-1);
    setOutside(true);
    hovered !== -1 && onHover?.(-1);
  };
  const handleTouchStart = (event) => {
    const { touches } = event;
    if (touches.length !== 1) {
      return;
    }
    if (!readOnly) {
      const touch = touches[0];
      setValue(getRatingFromCoordinates(touch.clientX));
    }
    onTouchStart?.(event);
  };
  const handleTouchEnd = (event) => {
    event.preventDefault();
    onTouchEnd?.(event);
  };
  const handleItemBlur = () => isOutside && setHovered(-1);
  const handleInputChange = (event) => {
    if (!readOnly) {
      if (typeof event === "number") {
        setHovered(event);
      } else {
        setHovered(parseFloat(event.target.value));
      }
    }
  };
  const handleChange = (event) => {
    if (!readOnly) {
      if (typeof event === "number") {
        setValue(event);
      } else {
        setValue(parseFloat(event.target.value));
      }
    }
  };
  const items = Array(_count).fill(0).map((_, index) => {
    const integerValue = index + 1;
    const fractionItems = Array.from(new Array(index === 0 ? _fractions + 1 : _fractions));
    const isGroupActive = !readOnly && Math.ceil(hovered) === integerValue;
    return /* @__PURE__ */ jsxRuntime.jsx(
      "div",
      {
        "data-active": isGroupActive || void 0,
        ...getStyles("symbolGroup"),
        children: fractionItems.map((__, fractionIndex) => {
          const fractionValue = decimalUnit * (index === 0 ? fractionIndex : fractionIndex + 1);
          const symbolValue = roundValueTo(integerValue - 1 + fractionValue, decimalUnit);
          return /* @__PURE__ */ jsxRuntime.jsx(
            RatingItem.RatingItem,
            {
              getSymbolLabel,
              emptyIcon: emptySymbol,
              fullIcon: fullSymbol,
              full: highlightSelectedOnly ? symbolValue === finalValue : symbolValue <= finalValue,
              active: symbolValue === finalValue,
              checked: symbolValue === stableValueRounded,
              readOnly,
              fractionValue,
              value: symbolValue,
              name: _name,
              onChange: handleChange,
              onBlur: handleItemBlur,
              onInputChange: handleInputChange,
              id: `${_id}-${index}-${fractionIndex}`
            },
            `${integerValue}-${symbolValue}`
          );
        })
      },
      integerValue
    );
  });
  return /* @__PURE__ */ jsxRuntime.jsx(Rating_context.RatingProvider, { value: { getStyles }, children: /* @__PURE__ */ jsxRuntime.jsx(
    Box.Box,
    {
      ref: hooks.useMergedRef(rootRef, ref),
      ...getStyles("root"),
      onMouseMove: handleMouseMove,
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
      onTouchStart: handleTouchStart,
      onTouchEnd: handleTouchEnd,
      variant,
      size,
      id: _id,
      ...others,
      children: items
    }
  ) });
});
Rating.classes = Rating_module;
Rating.displayName = "@mantine/core/Rating";

exports.Rating = Rating;
//# sourceMappingURL=Rating.cjs.map
