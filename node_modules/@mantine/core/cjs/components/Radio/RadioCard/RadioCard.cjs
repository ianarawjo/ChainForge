'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
require('react');
var getSize = require('../../../core/utils/get-size/get-size.cjs');
require('@mantine/hooks');
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
var DirectionProvider = require('../../../core/DirectionProvider/DirectionProvider.cjs');
var UnstyledButton = require('../../UnstyledButton/UnstyledButton.cjs');
var RadioGroup_context = require('../RadioGroup.context.cjs');
var RadioCard_context = require('./RadioCard.context.cjs');
var RadioCard_module = require('./RadioCard.module.css.cjs');

const defaultProps = {
  withBorder: true
};
const varsResolver = createVarsResolver.createVarsResolver((_, { radius }) => ({
  card: {
    "--card-radius": getSize.getRadius(radius)
  }
}));
const RadioCard = factory.factory((_props, ref) => {
  const props = useProps.useProps("RadioCard", defaultProps, _props);
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
  const getStyles = useStyles.useStyles({
    name: "RadioCard",
    classes: RadioCard_module,
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
  const { dir } = DirectionProvider.useDirection();
  const ctx = RadioGroup_context.useRadioGroupContext();
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
  return /* @__PURE__ */ jsxRuntime.jsx(RadioCard_context.RadioCardProvider, { value: { checked: _checked }, children: /* @__PURE__ */ jsxRuntime.jsx(
    UnstyledButton.UnstyledButton,
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
RadioCard.classes = RadioCard_module;

exports.RadioCard = RadioCard;
//# sourceMappingURL=RadioCard.cjs.map
