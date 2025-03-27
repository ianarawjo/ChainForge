'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var hooks = require('@mantine/hooks');
var rem = require('../../core/utils/units-converters/rem.cjs');
require('react');
var getSafeId = require('../../core/utils/get-safe-id/get-safe-id.cjs');
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
var Accordion_context = require('./Accordion.context.cjs');
var AccordionChevron = require('./AccordionChevron.cjs');
var AccordionControl = require('./AccordionControl/AccordionControl.cjs');
var AccordionItem = require('./AccordionItem/AccordionItem.cjs');
var AccordionPanel = require('./AccordionPanel/AccordionPanel.cjs');
var Accordion_module = require('./Accordion.module.css.cjs');

const defaultProps = {
  multiple: false,
  disableChevronRotation: false,
  chevronPosition: "right",
  variant: "default",
  chevron: /* @__PURE__ */ jsxRuntime.jsx(AccordionChevron.AccordionChevron, {})
};
const varsResolver = createVarsResolver.createVarsResolver(
  (_, { transitionDuration, chevronSize, radius }) => ({
    root: {
      "--accordion-transition-duration": transitionDuration === void 0 ? void 0 : `${transitionDuration}ms`,
      "--accordion-chevron-size": chevronSize === void 0 ? void 0 : rem.rem(chevronSize),
      "--accordion-radius": radius === void 0 ? void 0 : getSize.getRadius(radius)
    }
  })
);
function Accordion(_props) {
  const props = useProps.useProps("Accordion", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    children,
    multiple,
    value,
    defaultValue,
    onChange,
    id,
    loop,
    transitionDuration,
    disableChevronRotation,
    chevronPosition,
    chevronSize,
    order,
    chevron,
    variant,
    radius,
    ...others
  } = props;
  const uid = hooks.useId(id);
  const [_value, handleChange] = hooks.useUncontrolled({
    value,
    defaultValue,
    finalValue: multiple ? [] : null,
    onChange
  });
  const isItemActive = (itemValue) => Array.isArray(_value) ? _value.includes(itemValue) : itemValue === _value;
  const handleItemChange = (itemValue) => {
    const nextValue = Array.isArray(_value) ? _value.includes(itemValue) ? _value.filter((selectedValue) => selectedValue !== itemValue) : [..._value, itemValue] : itemValue === _value ? null : itemValue;
    handleChange(nextValue);
  };
  const getStyles = useStyles.useStyles({
    name: "Accordion",
    classes: Accordion_module,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  return /* @__PURE__ */ jsxRuntime.jsx(
    Accordion_context.AccordionProvider,
    {
      value: {
        isItemActive,
        onChange: handleItemChange,
        getControlId: getSafeId.getSafeId(
          `${uid}-control`,
          "Accordion.Item component was rendered with invalid value or without value"
        ),
        getRegionId: getSafeId.getSafeId(
          `${uid}-panel`,
          "Accordion.Item component was rendered with invalid value or without value"
        ),
        transitionDuration,
        disableChevronRotation,
        chevronPosition,
        order,
        chevron,
        loop,
        getStyles,
        variant,
        unstyled
      },
      children: /* @__PURE__ */ jsxRuntime.jsx(Box.Box, { ...getStyles("root"), id: uid, ...others, variant, "data-accordion": true, children })
    }
  );
}
const extendAccordion = (c) => c;
Accordion.extend = extendAccordion;
Accordion.withProps = factory.getWithProps(Accordion);
Accordion.classes = Accordion_module;
Accordion.displayName = "@mantine/core/Accordion";
Accordion.Item = AccordionItem.AccordionItem;
Accordion.Panel = AccordionPanel.AccordionPanel;
Accordion.Control = AccordionControl.AccordionControl;
Accordion.Chevron = AccordionChevron.AccordionChevron;

exports.Accordion = Accordion;
//# sourceMappingURL=Accordion.cjs.map
