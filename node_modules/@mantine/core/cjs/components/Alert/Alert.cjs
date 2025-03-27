'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var hooks = require('@mantine/hooks');
require('react');
var getSize = require('../../core/utils/get-size/get-size.cjs');
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
var factory = require('../../core/factory/factory.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
require('../CloseButton/CloseIcon.cjs');
var CloseButton = require('../CloseButton/CloseButton.cjs');
var Alert_module = require('./Alert.module.css.cjs');

const defaultProps = {};
const varsResolver = createVarsResolver.createVarsResolver(
  (theme, { radius, color, variant, autoContrast }) => {
    const colors = theme.variantColorResolver({
      color: color || theme.primaryColor,
      theme,
      variant: variant || "light",
      autoContrast
    });
    return {
      root: {
        "--alert-radius": radius === void 0 ? void 0 : getSize.getRadius(radius),
        "--alert-bg": color || variant ? colors.background : void 0,
        "--alert-color": colors.color,
        "--alert-bd": color || variant ? colors.border : void 0
      }
    };
  }
);
const Alert = factory.factory((_props, ref) => {
  const props = useProps.useProps("Alert", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    radius,
    color,
    title,
    children,
    id,
    icon,
    withCloseButton,
    onClose,
    closeButtonLabel,
    variant,
    autoContrast,
    ...others
  } = props;
  const getStyles = useStyles.useStyles({
    name: "Alert",
    classes: Alert_module,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  const rootId = hooks.useId(id);
  const titleId = title && `${rootId}-title` || void 0;
  const bodyId = `${rootId}-body`;
  return /* @__PURE__ */ jsxRuntime.jsx(
    Box.Box,
    {
      id: rootId,
      ...getStyles("root", { variant }),
      variant,
      ref,
      ...others,
      role: "alert",
      "aria-describedby": bodyId,
      "aria-labelledby": titleId,
      children: /* @__PURE__ */ jsxRuntime.jsxs("div", { ...getStyles("wrapper"), children: [
        icon && /* @__PURE__ */ jsxRuntime.jsx("div", { ...getStyles("icon"), children: icon }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { ...getStyles("body"), children: [
          title && /* @__PURE__ */ jsxRuntime.jsx("div", { ...getStyles("title"), "data-with-close-button": withCloseButton || void 0, children: /* @__PURE__ */ jsxRuntime.jsx("span", { id: titleId, ...getStyles("label"), children: title }) }),
          children && /* @__PURE__ */ jsxRuntime.jsx("div", { id: bodyId, ...getStyles("message"), "data-variant": variant, children })
        ] }),
        withCloseButton && /* @__PURE__ */ jsxRuntime.jsx(
          CloseButton.CloseButton,
          {
            ...getStyles("closeButton"),
            onClick: onClose,
            variant: "transparent",
            size: 16,
            iconSize: 16,
            "aria-label": closeButtonLabel,
            unstyled
          }
        )
      ] })
    }
  );
});
Alert.classes = Alert_module;
Alert.displayName = "@mantine/core/Alert";

exports.Alert = Alert;
//# sourceMappingURL=Alert.cjs.map
