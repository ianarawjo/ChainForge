'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
require('react');
var createScopedKeydownHandler = require('../../../core/utils/create-scoped-keydown-handler/create-scoped-keydown-handler.cjs');
require('@mantine/hooks');
require('clsx');
require('../../../core/MantineProvider/Mantine.context.cjs');
require('../../../core/MantineProvider/default-theme.cjs');
require('../../../core/MantineProvider/MantineProvider.cjs');
require('../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../../core/MantineProvider/use-props/use-props.cjs');
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var Box = require('../../../core/Box/Box.cjs');
var factory = require('../../../core/factory/factory.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');
var UnstyledButton = require('../../UnstyledButton/UnstyledButton.cjs');
var Accordion_context = require('../Accordion.context.cjs');
var AccordionItem_context = require('../AccordionItem.context.cjs');
var Accordion_module = require('../Accordion.module.css.cjs');

const defaultProps = {};
const AccordionControl = factory.factory((props, ref) => {
  const {
    classNames,
    className,
    style,
    styles,
    vars,
    chevron,
    icon,
    onClick,
    onKeyDown,
    children,
    disabled,
    mod,
    ...others
  } = useProps.useProps("AccordionControl", defaultProps, props);
  const { value } = AccordionItem_context.useAccordionItemContext();
  const ctx = Accordion_context.useAccordionContext();
  const isActive = ctx.isItemActive(value);
  const shouldWrapWithHeading = typeof ctx.order === "number";
  const Heading = `h${ctx.order}`;
  const content = /* @__PURE__ */ jsxRuntime.jsxs(
    UnstyledButton.UnstyledButton,
    {
      ...others,
      ...ctx.getStyles("control", { className, classNames, style, styles, variant: ctx.variant }),
      unstyled: ctx.unstyled,
      mod: [
        "accordion-control",
        { active: isActive, "chevron-position": ctx.chevronPosition, disabled },
        mod
      ],
      ref,
      onClick: (event) => {
        onClick?.(event);
        ctx.onChange(value);
      },
      type: "button",
      disabled,
      "aria-expanded": isActive,
      "aria-controls": ctx.getRegionId(value),
      id: ctx.getControlId(value),
      onKeyDown: createScopedKeydownHandler.createScopedKeydownHandler({
        siblingSelector: "[data-accordion-control]",
        parentSelector: "[data-accordion]",
        activateOnFocus: false,
        loop: ctx.loop,
        orientation: "vertical",
        onKeyDown
      }),
      children: [
        /* @__PURE__ */ jsxRuntime.jsx(
          Box.Box,
          {
            component: "span",
            mod: { rotate: !ctx.disableChevronRotation && isActive, position: ctx.chevronPosition },
            ...ctx.getStyles("chevron", { classNames, styles }),
            children: chevron || ctx.chevron
          }
        ),
        /* @__PURE__ */ jsxRuntime.jsx("span", { ...ctx.getStyles("label", { classNames, styles }), children }),
        icon && /* @__PURE__ */ jsxRuntime.jsx(
          Box.Box,
          {
            component: "span",
            mod: { "chevron-position": ctx.chevronPosition },
            ...ctx.getStyles("icon", { classNames, styles }),
            children: icon
          }
        )
      ]
    }
  );
  return shouldWrapWithHeading ? /* @__PURE__ */ jsxRuntime.jsx(Heading, { ...ctx.getStyles("itemTitle", { classNames, styles }), children: content }) : content;
});
AccordionControl.displayName = "@mantine/core/AccordionControl";
AccordionControl.classes = Accordion_module;

exports.AccordionControl = AccordionControl;
//# sourceMappingURL=AccordionControl.cjs.map
