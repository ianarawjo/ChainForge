'use client';
import { jsx } from 'react/jsx-runtime';
import { useId, useUncontrolled } from '@mantine/hooks';
import { rem } from '../../core/utils/units-converters/rem.mjs';
import 'react';
import { getSafeId } from '../../core/utils/get-safe-id/get-safe-id.mjs';
import { getRadius } from '../../core/utils/get-size/get-size.mjs';
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
import { getWithProps } from '../../core/factory/factory.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import { AccordionProvider } from './Accordion.context.mjs';
import { AccordionChevron } from './AccordionChevron.mjs';
import { AccordionControl } from './AccordionControl/AccordionControl.mjs';
import { AccordionItem } from './AccordionItem/AccordionItem.mjs';
import { AccordionPanel } from './AccordionPanel/AccordionPanel.mjs';
import classes from './Accordion.module.css.mjs';

const defaultProps = {
  multiple: false,
  disableChevronRotation: false,
  chevronPosition: "right",
  variant: "default",
  chevron: /* @__PURE__ */ jsx(AccordionChevron, {})
};
const varsResolver = createVarsResolver(
  (_, { transitionDuration, chevronSize, radius }) => ({
    root: {
      "--accordion-transition-duration": transitionDuration === void 0 ? void 0 : `${transitionDuration}ms`,
      "--accordion-chevron-size": chevronSize === void 0 ? void 0 : rem(chevronSize),
      "--accordion-radius": radius === void 0 ? void 0 : getRadius(radius)
    }
  })
);
function Accordion(_props) {
  const props = useProps("Accordion", defaultProps, _props);
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
  const uid = useId(id);
  const [_value, handleChange] = useUncontrolled({
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
  const getStyles = useStyles({
    name: "Accordion",
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
  return /* @__PURE__ */ jsx(
    AccordionProvider,
    {
      value: {
        isItemActive,
        onChange: handleItemChange,
        getControlId: getSafeId(
          `${uid}-control`,
          "Accordion.Item component was rendered with invalid value or without value"
        ),
        getRegionId: getSafeId(
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
      children: /* @__PURE__ */ jsx(Box, { ...getStyles("root"), id: uid, ...others, variant, "data-accordion": true, children })
    }
  );
}
const extendAccordion = (c) => c;
Accordion.extend = extendAccordion;
Accordion.withProps = getWithProps(Accordion);
Accordion.classes = classes;
Accordion.displayName = "@mantine/core/Accordion";
Accordion.Item = AccordionItem;
Accordion.Panel = AccordionPanel;
Accordion.Control = AccordionControl;
Accordion.Chevron = AccordionChevron;

export { Accordion };
//# sourceMappingURL=Accordion.mjs.map
