'use client';
import { jsx } from 'react/jsx-runtime';
import 'react';
import { getRadius } from '../../../core/utils/get-size/get-size.mjs';
import '@mantine/hooks';
import { createVarsResolver } from '../../../core/styles-api/create-vars-resolver/create-vars-resolver.mjs';
import 'clsx';
import '../../../core/MantineProvider/Mantine.context.mjs';
import '../../../core/MantineProvider/default-theme.mjs';
import '../../../core/MantineProvider/MantineProvider.mjs';
import '../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../../core/MantineProvider/use-props/use-props.mjs';
import '../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { useStyles } from '../../../core/styles-api/use-styles/use-styles.mjs';
import '../../../core/Box/Box.mjs';
import { factory } from '../../../core/factory/factory.mjs';
import { useDirection } from '../../../core/DirectionProvider/DirectionProvider.mjs';
import { UnstyledButton } from '../../UnstyledButton/UnstyledButton.mjs';
import { useRadioGroupContext } from '../RadioGroup.context.mjs';
import { RadioCardProvider } from './RadioCard.context.mjs';
import classes from './RadioCard.module.css.mjs';

const defaultProps = {
  withBorder: true
};
const varsResolver = createVarsResolver((_, { radius }) => ({
  card: {
    "--card-radius": getRadius(radius)
  }
}));
const RadioCard = factory((_props, ref) => {
  const props = useProps("RadioCard", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    checked,
    mod,
    withBorder,
    value,
    onClick,
    name,
    onKeyDown,
    ...others
  } = props;
  const getStyles = useStyles({
    name: "RadioCard",
    classes,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver,
    rootSelector: "card"
  });
  const { dir } = useDirection();
  const ctx = useRadioGroupContext();
  const _checked = typeof checked === "boolean" ? checked : ctx?.value === value || false;
  const _name = name || ctx?.name;
  const handleKeyDown = (event) => {
    onKeyDown?.(event);
    if (["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(event.nativeEvent.code)) {
      event.preventDefault();
      const siblings = Array.from(
        document.querySelectorAll(
          `[role="radio"][name="${_name || "__mantine"}"]`
        )
      );
      const currentIndex = siblings.findIndex((element) => element === event.target);
      const nextIndex = currentIndex + 1 >= siblings.length ? 0 : currentIndex + 1;
      const prevIndex = currentIndex - 1 < 0 ? siblings.length - 1 : currentIndex - 1;
      if (event.nativeEvent.code === "ArrowDown") {
        siblings[nextIndex].focus();
        siblings[nextIndex].click();
      }
      if (event.nativeEvent.code === "ArrowUp") {
        siblings[prevIndex].focus();
        siblings[prevIndex].click();
      }
      if (event.nativeEvent.code === "ArrowLeft") {
        siblings[dir === "ltr" ? prevIndex : nextIndex].focus();
        siblings[dir === "ltr" ? prevIndex : nextIndex].click();
      }
      if (event.nativeEvent.code === "ArrowRight") {
        siblings[dir === "ltr" ? nextIndex : prevIndex].focus();
        siblings[dir === "ltr" ? nextIndex : prevIndex].click();
      }
    }
  };
  return /* @__PURE__ */ jsx(RadioCardProvider, { value: { checked: _checked }, children: /* @__PURE__ */ jsx(
    UnstyledButton,
    {
      ref,
      mod: [{ "with-border": withBorder, checked: _checked }, mod],
      ...getStyles("card"),
      ...others,
      role: "radio",
      "aria-checked": _checked,
      name: _name,
      onClick: (event) => {
        onClick?.(event);
        ctx?.onChange(value || "");
      },
      onKeyDown: handleKeyDown
    }
  ) });
});
RadioCard.displayName = "@mantine/core/RadioCard";
RadioCard.classes = classes;

export { RadioCard };
//# sourceMappingURL=RadioCard.mjs.map
