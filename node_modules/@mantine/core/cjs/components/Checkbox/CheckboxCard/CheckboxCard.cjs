'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var hooks = require('@mantine/hooks');
require('react');
var getSize = require('../../../core/utils/get-size/get-size.cjs');
var createVarsResolver = require('../../../core/styles-api/create-vars-resolver/create-vars-resolver.cjs');
require('clsx');
require('../../../core/MantineProvider/Mantine.context.cjs');
require('../../../core/MantineProvider/default-theme.cjs');
require('../../../core/MantineProvider/MantineProvider.cjs');
require('../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../../core/MantineProvider/use-props/use-props.cjs');
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var useStyles = require('../../../core/styles-api/use-styles/use-styles.cjs');
require('../../../core/Box/Box.cjs');
var factory = require('../../../core/factory/factory.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');
var UnstyledButton = require('../../UnstyledButton/UnstyledButton.cjs');
var CheckboxGroup_context = require('../CheckboxGroup.context.cjs');
var CheckboxCard_context = require('./CheckboxCard.context.cjs');
var CheckboxCard_module = require('./CheckboxCard.module.css.cjs');

const defaultProps = {
  withBorder: true
};
const varsResolver = createVarsResolver.createVarsResolver((_, { radius }) => ({
  card: {
    "--card-radius": getSize.getRadius(radius)
  }
}));
const CheckboxCard = factory.factory((_props, ref) => {
  const props = useProps.useProps("CheckboxCard", defaultProps, _props);
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
  const getStyles = useStyles.useStyles({
    name: "CheckboxCard",
    classes: CheckboxCard_module,
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
  const ctx = CheckboxGroup_context.useCheckboxGroupContext();
  const _checked = typeof checked === "boolean" ? checked : ctx ? ctx.value.includes(value || "") : void 0;
  const [_value, setValue] = hooks.useUncontrolled({
    value: _checked,
    defaultValue: defaultChecked,
    finalValue: false,
    onChange
  });
  return /* @__PURE__ */ jsxRuntime.jsx(CheckboxCard_context.CheckboxCardProvider, { value: { checked: _value }, children: /* @__PURE__ */ jsxRuntime.jsx(
    UnstyledButton.UnstyledButton,
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
CheckboxCard.classes = CheckboxCard_module;

exports.CheckboxCard = CheckboxCard;
//# sourceMappingURL=CheckboxCard.cjs.map
