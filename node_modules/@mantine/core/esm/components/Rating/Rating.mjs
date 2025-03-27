'use client';
import { jsx } from 'react/jsx-runtime';
import { useRef, useState } from 'react';
import { useId, useUncontrolled, useMergedRef, clamp } from '@mantine/hooks';
import { getSize } from '../../core/utils/get-size/get-size.mjs';
import { createVarsResolver } from '../../core/styles-api/create-vars-resolver/create-vars-resolver.mjs';
import 'clsx';
import { getThemeColor } from '../../core/MantineProvider/color-functions/get-theme-color/get-theme-color.mjs';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../core/MantineProvider/use-props/use-props.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { useStyles } from '../../core/styles-api/use-styles/use-styles.mjs';
import { Box } from '../../core/Box/Box.mjs';
import { factory } from '../../core/factory/factory.mjs';
import { useDirection } from '../../core/DirectionProvider/DirectionProvider.mjs';
import { RatingProvider } from './Rating.context.mjs';
import { RatingItem } from './RatingItem/RatingItem.mjs';
import classes from './Rating.module.css.mjs';

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
const varsResolver = createVarsResolver((theme, { size, color }) => ({
  root: {
    "--rating-size": getSize(size, "rating-size"),
    "--rating-color": getThemeColor(color, theme)
  }
}));
const Rating = factory((_props, ref) => {
  const props = useProps("Rating", defaultProps, _props);
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
  const getStyles = useStyles({
    name: "Rating",
    classes,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  const { dir } = useDirection();
  const _name = useId(name);
  const _id = useId(id);
  const rootRef = useRef(null);
  const [_value, setValue] = useUncontrolled({
    value,
    defaultValue,
    finalValue: 0,
    onChange
  });
  const [hovered, setHovered] = useState(-1);
  const [isOutside, setOutside] = useState(true);
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
    return clamp(roundValueTo(hoverValue + decimalUnit / 2, decimalUnit), decimalUnit, _count);
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
    return /* @__PURE__ */ jsx(
      "div",
      {
        "data-active": isGroupActive || void 0,
        ...getStyles("symbolGroup"),
        children: fractionItems.map((__, fractionIndex) => {
          const fractionValue = decimalUnit * (index === 0 ? fractionIndex : fractionIndex + 1);
          const symbolValue = roundValueTo(integerValue - 1 + fractionValue, decimalUnit);
          return /* @__PURE__ */ jsx(
            RatingItem,
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
  return /* @__PURE__ */ jsx(RatingProvider, { value: { getStyles }, children: /* @__PURE__ */ jsx(
    Box,
    {
      ref: useMergedRef(rootRef, ref),
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
Rating.classes = classes;
Rating.displayName = "@mantine/core/Rating";

export { Rating };
//# sourceMappingURL=Rating.mjs.map
