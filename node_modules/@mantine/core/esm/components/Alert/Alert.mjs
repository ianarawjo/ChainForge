'use client';
import { jsx, jsxs } from 'react/jsx-runtime';
import { useId } from '@mantine/hooks';
import 'react';
import { getRadius } from '../../core/utils/get-size/get-size.mjs';
import { createVarsResolver } from '../../core/styles-api/create-vars-resolver/create-vars-resolver.mjs';
import 'clsx';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../core/MantineProvider/use-props/use-props.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { useStyles } from '../../core/styles-api/use-styles/use-styles.mjs';
import { Box } from '../../core/Box/Box.mjs';
import { factory } from '../../core/factory/factory.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import '../CloseButton/CloseIcon.mjs';
import { CloseButton } from '../CloseButton/CloseButton.mjs';
import classes from './Alert.module.css.mjs';

const defaultProps = {};
const varsResolver = createVarsResolver(
  (theme, { radius, color, variant, autoContrast }) => {
    const colors = theme.variantColorResolver({
      color: color || theme.primaryColor,
      theme,
      variant: variant || "light",
      autoContrast
    });
    return {
      root: {
        "--alert-radius": radius === void 0 ? void 0 : getRadius(radius),
        "--alert-bg": color || variant ? colors.background : void 0,
        "--alert-color": colors.color,
        "--alert-bd": color || variant ? colors.border : void 0
      }
    };
  }
);
const Alert = factory((_props, ref) => {
  const props = useProps("Alert", defaultProps, _props);
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
  const getStyles = useStyles({
    name: "Alert",
    classes,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  const rootId = useId(id);
  const titleId = title && `${rootId}-title` || void 0;
  const bodyId = `${rootId}-body`;
  return /* @__PURE__ */ jsx(
    Box,
    {
      id: rootId,
      ...getStyles("root", { variant }),
      variant,
      ref,
      ...others,
      role: "alert",
      "aria-describedby": bodyId,
      "aria-labelledby": titleId,
      children: /* @__PURE__ */ jsxs("div", { ...getStyles("wrapper"), children: [
        icon && /* @__PURE__ */ jsx("div", { ...getStyles("icon"), children: icon }),
        /* @__PURE__ */ jsxs("div", { ...getStyles("body"), children: [
          title && /* @__PURE__ */ jsx("div", { ...getStyles("title"), "data-with-close-button": withCloseButton || void 0, children: /* @__PURE__ */ jsx("span", { id: titleId, ...getStyles("label"), children: title }) }),
          children && /* @__PURE__ */ jsx("div", { id: bodyId, ...getStyles("message"), "data-variant": variant, children })
        ] }),
        withCloseButton && /* @__PURE__ */ jsx(
          CloseButton,
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
Alert.classes = classes;
Alert.displayName = "@mantine/core/Alert";

export { Alert };
//# sourceMappingURL=Alert.mjs.map
