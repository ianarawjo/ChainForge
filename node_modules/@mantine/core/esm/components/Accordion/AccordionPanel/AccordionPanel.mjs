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
import '../../../core/Box/Box.mjs';
import { factory } from '../../../core/factory/factory.mjs';
import '../../../core/DirectionProvider/DirectionProvider.mjs';
import { Collapse } from '../../Collapse/Collapse.mjs';
import { useAccordionContext } from '../Accordion.context.mjs';
import { useAccordionItemContext } from '../AccordionItem.context.mjs';
import classes from '../Accordion.module.css.mjs';

const defaultProps = {};
const AccordionPanel = factory((props, ref) => {
  const { classNames, className, style, styles, vars, children, ...others } = useProps(
    "AccordionPanel",
    defaultProps,
    props
  );
  const { value } = useAccordionItemContext();
  const ctx = useAccordionContext();
  return /* @__PURE__ */ jsx(
    Collapse,
    {
      ref,
      ...ctx.getStyles("panel", { className, classNames, style, styles }),
      ...others,
      in: ctx.isItemActive(value),
      transitionDuration: ctx.transitionDuration ?? 200,
      role: "region",
      id: ctx.getRegionId(value),
      "aria-labelledby": ctx.getControlId(value),
      children: /* @__PURE__ */ jsx("div", { ...ctx.getStyles("content", { classNames, styles }), children })
    }
  );
});
AccordionPanel.displayName = "@mantine/core/AccordionPanel";
AccordionPanel.classes = classes;

export { AccordionPanel };
//# sourceMappingURL=AccordionPanel.mjs.map
