'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var hooks = require('@mantine/hooks');
var rem = require('../../core/utils/units-converters/rem.cjs');
var findClosestNumber = require('../../core/utils/find-closest-number/find-closest-number.cjs');
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
var AngleSlider_module = require('./AngleSlider.module.css.cjs');

const defaultProps = {
  step: 1,
  withLabel: true
};
const varsResolver = createVarsResolver.createVarsResolver((_, { size, thumbSize }) => ({
  root: {
    "--slider-size": rem.rem(size),
    "--thumb-size": rem.rem(thumbSize)
  }
}));
const AngleSlider = factory.factory((_props, ref) => {
  const props = useProps.useProps("AngleSlider", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    step,
    value,
    defaultValue,
    onChange,
    onMouseDown,
    withLabel,
    marks,
    thumbSize,
    restrictToMarks,
    formatLabel,
    onChangeEnd,
    disabled,
    onTouchStart,
    name,
    hiddenInputProps,
    "aria-label": ariaLabel,
    tabIndex,
    onScrubStart,
    onScrubEnd,
    ...others
  } = props;
  const [_value, setValue] = hooks.useUncontrolled({
    value,
    defaultValue,
    finalValue: 0,
    onChange
  });
  const update = (val) => {
    if (rootRef.current) {
      const newValue = restrictToMarks && Array.isArray(marks) ? findClosestNumber.findClosestNumber(
        val,
        marks.map((mark) => mark.value)
      ) : val;
      setValue(newValue);
    }
  };
  const { ref: rootRef } = hooks.useRadialMove(update, {
    step,
    onChangeEnd,
    onScrubStart,
    onScrubEnd
  });
  const getStyles = useStyles.useStyles({
    name: "AngleSlider",
    classes: AngleSlider_module,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  const handleKeyDown = (event) => {
    if (disabled) {
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      const normalized = hooks.normalizeRadialValue(_value - step, step);
      setValue(normalized);
      onChangeEnd?.(normalized);
    }
    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      const normalized = hooks.normalizeRadialValue(_value + step, step);
      setValue(normalized);
      onChangeEnd?.(normalized);
    }
    if (event.key === "Home") {
      setValue(0);
      onChangeEnd?.(0);
    }
    if (event.key === "End") {
      setValue(359);
      onChangeEnd?.(359);
    }
  };
  const marksItems = marks?.map((mark, index) => /* @__PURE__ */ React.createElement(
    "div",
    {
      ...getStyles("mark", { style: { "--angle": `${mark.value}deg` } }),
      "data-label": mark.label || void 0,
      key: index
    }
  ));
  return /* @__PURE__ */ jsxRuntime.jsxs(Box.Box, { ref: hooks.useMergedRef(ref, rootRef), ...getStyles("root", { focusable: true }), ...others, children: [
    marksItems && marksItems.length > 0 && /* @__PURE__ */ jsxRuntime.jsx("div", { ...getStyles("marks"), children: marksItems }),
    withLabel && /* @__PURE__ */ jsxRuntime.jsx("div", { ...getStyles("label"), children: typeof formatLabel === "function" ? formatLabel(_value) : _value }),
    /* @__PURE__ */ jsxRuntime.jsx(
      "div",
      {
        tabIndex: tabIndex ?? (disabled ? -1 : 0),
        role: "slider",
        "aria-valuemax": 360,
        "aria-valuemin": 0,
        "aria-valuenow": _value,
        onKeyDown: handleKeyDown,
        "aria-label": ariaLabel,
        ...getStyles("thumb", { style: { transform: `rotate(${_value}deg)` } })
      }
    ),
    /* @__PURE__ */ jsxRuntime.jsx("input", { type: "hidden", name, value: _value, ...hiddenInputProps })
  ] });
});
AngleSlider.displayName = "@mantine/core/AngleSlider";
AngleSlider.classes = AngleSlider_module;

exports.AngleSlider = AngleSlider;
//# sourceMappingURL=AngleSlider.cjs.map
