'use client';
import { jsx } from 'react/jsx-runtime';
import { useUncontrolled } from '@mantine/hooks';
import 'react';
import { getRadius } from '../../../core/utils/get-size/get-size.mjs';
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
import '../../../core/DirectionProvider/DirectionProvider.mjs';
import { UnstyledButton } from '../../UnstyledButton/UnstyledButton.mjs';
import { useCheckboxGroupContext } from '../CheckboxGroup.context.mjs';
import { CheckboxCardProvider } from './CheckboxCard.context.mjs';
import classes from './CheckboxCard.module.css.mjs';

const defaultProps = {
  withBorder: true
};
const varsResolver = createVarsResolver((_, { radius }) => ({
  card: {
    "--card-radius": getRadius(radius)
  }
}));
const CheckboxCard = factory((_props, ref) => {
  const props = useProps("CheckboxCard", defaultProps, _props);
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
    defaultChecked,
    onChange,
    ...others
  } = props;
  const getStyles = useStyles({
    name: "CheckboxCard",
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
  const ctx = useCheckboxGroupContext();
  const _checked = typeof checked === "boolean" ? checked : ctx ? ctx.value.includes(value || "") : void 0;
  const [_value, setValue] = useUncontrolled({
    value: _checked,
    defaultValue: defaultChecked,
    finalValue: false,
    onChange
  });
  return /* @__PURE__ */ jsx(CheckboxCardProvider, { value: { checked: _value }, children: /* @__PURE__ */ jsx(
    UnstyledButton,
    {
      ref,
      mod: [{ "with-border": withBorder, checked: _value }, mod],
      ...getStyles("card"),
      ...others,
      role: "checkbox",
      "aria-checked": _value,
      onClick: (event) => {
        onClick?.(event);
        ctx?.onChange(value || "");
        setValue(!_value);
      }
    }
  ) });
});
CheckboxCard.displayName = "@mantine/core/CheckboxCard";
CheckboxCard.classes = classes;

export { CheckboxCard };
//# sourceMappingURL=CheckboxCard.mjs.map
