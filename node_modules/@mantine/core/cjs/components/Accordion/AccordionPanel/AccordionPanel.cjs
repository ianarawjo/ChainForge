'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
require('react');
require('@mantine/hooks');
require('clsx');
require('../../../core/MantineProvider/Mantine.context.cjs');
require('../../../core/MantineProvider/default-theme.cjs');
require('../../../core/MantineProvider/MantineProvider.cjs');
require('../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../../core/MantineProvider/use-props/use-props.cjs');
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
require('../../../core/Box/Box.cjs');
var factory = require('../../../core/factory/factory.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');
var Collapse = require('../../Collapse/Collapse.cjs');
var Accordion_context = require('../Accordion.context.cjs');
var AccordionItem_context = require('../AccordionItem.context.cjs');
var Accordion_module = require('../Accordion.module.css.cjs');

const defaultProps = {};
const AccordionPanel = factory.factory((props, ref) => {
  const { classNames, className, style, styles, vars, children, ...others } = useProps.useProps(
    "AccordionPanel",
    defaultProps,
    props
  );
  const { value } = AccordionItem_context.useAccordionItemContext();
  const ctx = Accordion_context.useAccordionContext();
  return /* @__PURE__ */ jsxRuntime.jsx(
    Collapse.Collapse,
    {
      ref,
      ...ctx.getStyles("panel", { className, classNames, style, styles }),
      ...others,
      in: ctx.isItemActive(value),
      transitionDuration: ctx.transitionDuration ?? 200,
      role: "region",
      id: ctx.getRegionId(value),
      "aria-labelledby": ctx.getControlId(value),
      children: /* @__PURE__ */ jsxRuntime.jsx("div", { ...ctx.getStyles("content", { classNames, styles }), children })
    }
  );
});
AccordionPanel.displayName = "@mantine/core/AccordionPanel";
AccordionPanel.classes = Accordion_module;

exports.AccordionPanel = AccordionPanel;
//# sourceMappingURL=AccordionPanel.cjs.map
