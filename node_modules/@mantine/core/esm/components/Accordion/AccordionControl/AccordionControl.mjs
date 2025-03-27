'use client';
import { jsxs, jsx } from 'react/jsx-runtime';
import 'react';
import { createScopedKeydownHandler } from '../../../core/utils/create-scoped-keydown-handler/create-scoped-keydown-handler.mjs';
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
import { UnstyledButton } from '../../UnstyledButton/UnstyledButton.mjs';
import { useAccordionContext } from '../Accordion.context.mjs';
import { useAccordionItemContext } from '../AccordionItem.context.mjs';
import classes from '../Accordion.module.css.mjs';

const defaultProps = {};
const AccordionControl = factory((props, ref) => {
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
  } = useProps("AccordionControl", defaultProps, props);
  const { value } = useAccordionItemContext();
  const ctx = useAccordionContext();
  const isActive = ctx.isItemActive(value);
  const shouldWrapWithHeading = typeof ctx.order === "number";
  const Heading = `h${ctx.order}`;
  const content = /* @__PURE__ */ jsxs(
    UnstyledButton,
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
      onKeyDown: createScopedKeydownHandler({
        siblingSelector: "[data-accordion-control]",
        parentSelector: "[data-accordion]",
        activateOnFocus: false,
        loop: ctx.loop,
        orientation: "vertical",
        onKeyDown
      }),
      children: [
        /* @__PURE__ */ jsx(
          Box,
          {
            component: "span",
            mod: { rotate: !ctx.disableChevronRotation && isActive, position: ctx.chevronPosition },
            ...ctx.getStyles("chevron", { classNames, styles }),
            children: chevron || ctx.chevron
          }
        ),
        /* @__PURE__ */ jsx("span", { ...ctx.getStyles("label", { classNames, styles }), children }),
        icon && /* @__PURE__ */ jsx(
          Box,
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
  return shouldWrapWithHeading ? /* @__PURE__ */ jsx(Heading, { ...ctx.getStyles("itemTitle", { classNames, styles }), children: content }) : content;
});
AccordionControl.displayName = "@mantine/core/AccordionControl";
AccordionControl.classes = classes;

export { AccordionControl };
//# sourceMappingURL=AccordionControl.mjs.map
