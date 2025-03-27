'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var rem = require('../../core/utils/units-converters/rem.cjs');
require('react');
var getSize = require('../../core/utils/get-size/get-size.cjs');
require('@mantine/hooks');
var createVarsResolver = require('../../core/styles-api/create-vars-resolver/create-vars-resolver.cjs');
require('clsx');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../core/MantineProvider/use-props/use-props.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var useStyles = require('../../core/styles-api/use-styles/use-styles.cjs');
var Box = require('../../core/Box/Box.cjs');
var polymorphicFactory = require('../../core/factory/polymorphic-factory.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
var Loader = require('../Loader/Loader.cjs');
var Transition = require('../Transition/Transition.cjs');
var UnstyledButton = require('../UnstyledButton/UnstyledButton.cjs');
var ButtonGroup = require('./ButtonGroup/ButtonGroup.cjs');
var ButtonGroupSection = require('./ButtonGroupSection/ButtonGroupSection.cjs');
var Button_module = require('./Button.module.css.cjs');

const loaderTransition = {
  in: { opacity: 1, transform: `translate(-50%, calc(-50% + ${rem.rem(1)}))` },
  out: { opacity: 0, transform: "translate(-50%, -200%)" },
  common: { transformOrigin: "center" },
  transitionProperty: "transform, opacity"
};
const defaultProps = {};
const varsResolver = createVarsResolver.createVarsResolver(
  (theme, { radius, color, gradient, variant, size, justify, autoContrast }) => {
    const colors = theme.variantColorResolver({
      color: color || theme.primaryColor,
      theme,
      gradient,
      variant: variant || "filled",
      autoContrast
    });
    return {
      root: {
        "--button-justify": justify,
        "--button-height": getSize.getSize(size, "button-height"),
        "--button-padding-x": getSize.getSize(size, "button-padding-x"),
        "--button-fz": size?.includes("compact") ? getSize.getFontSize(size.replace("compact-", "")) : getSize.getFontSize(size),
        "--button-radius": radius === void 0 ? void 0 : getSize.getRadius(radius),
        "--button-bg": color || variant ? colors.background : void 0,
        "--button-hover": color || variant ? colors.hover : void 0,
        "--button-color": colors.color,
        "--button-bd": color || variant ? colors.border : void 0,
        "--button-hover-color": color || variant ? colors.hoverColor : void 0
      }
    };
  }
);
const Button = polymorphicFactory.polymorphicFactory((_props, ref) => {
  const props = useProps.useProps("Button", defaultProps, _props);
  const {
    style,
    vars,
    className,
    color,
    disabled,
    children,
    leftSection,
    rightSection,
    fullWidth,
    variant,
    radius,
    loading,
    loaderProps,
    gradient,
    classNames,
    styles,
    unstyled,
    "data-disabled": dataDisabled,
    autoContrast,
    mod,
    ...others
  } = props;
  const getStyles = useStyles.useStyles({
    name: "Button",
    props,
    classes: Button_module,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  const hasLeftSection = !!leftSection;
  const hasRightSection = !!rightSection;
  return /* @__PURE__ */ jsxRuntime.jsxs(
    UnstyledButton.UnstyledButton,
    {
      ref,
      ...getStyles("root", { active: !disabled && !loading && !dataDisabled }),
      unstyled,
      variant,
      disabled: disabled || loading,
      mod: [
        {
          disabled: disabled || dataDisabled,
          loading,
          block: fullWidth,
          "with-left-section": hasLeftSection,
          "with-right-section": hasRightSection
        },
        mod
      ],
      ...others,
      children: [
        /* @__PURE__ */ jsxRuntime.jsx(Transition.Transition, { mounted: !!loading, transition: loaderTransition, duration: 150, children: (transitionStyles) => /* @__PURE__ */ jsxRuntime.jsx(Box.Box, { component: "span", ...getStyles("loader", { style: transitionStyles }), "aria-hidden": true, children: /* @__PURE__ */ jsxRuntime.jsx(
          Loader.Loader,
          {
            color: "var(--button-color)",
            size: "calc(var(--button-height) / 1.8)",
            ...loaderProps
          }
        ) }) }),
        /* @__PURE__ */ jsxRuntime.jsxs("span", { ...getStyles("inner"), children: [
          leftSection && /* @__PURE__ */ jsxRuntime.jsx(Box.Box, { component: "span", ...getStyles("section"), mod: { position: "left" }, children: leftSection }),
          /* @__PURE__ */ jsxRuntime.jsx(Box.Box, { component: "span", mod: { loading }, ...getStyles("label"), children }),
          rightSection && /* @__PURE__ */ jsxRuntime.jsx(Box.Box, { component: "span", ...getStyles("section"), mod: { position: "right" }, children: rightSection })
        ] })
      ]
    }
  );
});
Button.classes = Button_module;
Button.displayName = "@mantine/core/Button";
Button.Group = ButtonGroup.ButtonGroup;
Button.GroupSection = ButtonGroupSection.ButtonGroupSection;

exports.Button = Button;
//# sourceMappingURL=Button.cjs.map
