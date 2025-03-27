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
var Box = require('../../../core/Box/Box.cjs');
var factory = require('../../../core/factory/factory.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');
var Accordion_context = require('../Accordion.context.cjs');
var AccordionItem_context = require('../AccordionItem.context.cjs');
var Accordion_module = require('../Accordion.module.css.cjs');

const defaultProps = {};
const AccordionItem = factory.factory((props, ref) => {
  const { classNames, className, style, styles, vars, value, mod, ...others } = useProps.useProps(
    "AccordionItem",
    defaultProps,
    props
  );
  const ctx = Accordion_context.useAccordionContext();
  return /* @__PURE__ */ jsxRuntime.jsx(AccordionItem_context.AccordionItemProvider, { value: { value }, children: /* @__PURE__ */ jsxRuntime.jsx(
    Box.Box,
    {
      ref,
      mod: [{ active: ctx.isItemActive(value) }, mod],
      ...ctx.getStyles("item", { className, classNames, styles, style, variant: ctx.variant }),
      ...others
    }
  ) });
});
AccordionItem.displayName = "@mantine/core/AccordionItem";
AccordionItem.classes = Accordion_module;

exports.AccordionItem = AccordionItem;
//# sourceMappingURL=AccordionItem.cjs.map
