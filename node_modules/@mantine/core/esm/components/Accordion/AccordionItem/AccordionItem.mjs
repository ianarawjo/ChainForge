'use client';
import { jsx } from 'react/jsx-runtime';
import 'react';
import '@mantine/hooks';
import 'clsx';
import '../../../core/MantineProvider/Mantine.context.mjs';
import '../../../core/MantineProvider/default-theme.mjs';
import '../../../core/MantineProvider/MantineProvider.mjs';
import '../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../../core/MantineProvider/use-props/use-props.mjs';
import '../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { Box } from '../../../core/Box/Box.mjs';
import { factory } from '../../../core/factory/factory.mjs';
import '../../../core/DirectionProvider/DirectionProvider.mjs';
import { useAccordionContext } from '../Accordion.context.mjs';
import { AccordionItemProvider } from '../AccordionItem.context.mjs';
import classes from '../Accordion.module.css.mjs';

const defaultProps = {};
const AccordionItem = factory((props, ref) => {
  const { classNames, className, style, styles, vars, value, mod, ...others } = useProps(
    "AccordionItem",
    defaultProps,
    props
  );
  const ctx = useAccordionContext();
  return /* @__PURE__ */ jsx(AccordionItemProvider, { value: { value }, children: /* @__PURE__ */ jsx(
    Box,
    {
      ref,
      mod: [{ active: ctx.isItemActive(value) }, mod],
      ...ctx.getStyles("item", { className, classNames, styles, style, variant: ctx.variant }),
      ...others
    }
  ) });
});
AccordionItem.displayName = "@mantine/core/AccordionItem";
AccordionItem.classes = classes;

export { AccordionItem };
//# sourceMappingURL=AccordionItem.mjs.map
