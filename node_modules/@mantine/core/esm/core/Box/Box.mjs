'use client';
import { jsxs, Fragment, jsx } from 'react/jsx-runtime';
import { forwardRef } from 'react';
import cx from 'clsx';
import { createPolymorphicComponent } from '../factory/create-polymorphic-component.mjs';
import { InlineStyles } from '../InlineStyles/InlineStyles.mjs';
import { isNumberLike } from '../utils/is-number-like/is-number-like.mjs';
import '@mantine/hooks';
import { useMantineSxTransform } from '../MantineProvider/Mantine.context.mjs';
import '../MantineProvider/default-theme.mjs';
import '../MantineProvider/MantineProvider.mjs';
import { useMantineTheme } from '../MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import '../MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { getBoxMod } from './get-box-mod/get-box-mod.mjs';
import { getBoxStyle } from './get-box-style/get-box-style.mjs';
import { extractStyleProps } from './style-props/extract-style-props/extract-style-props.mjs';
import { STYlE_PROPS_DATA } from './style-props/style-props-data.mjs';
import { parseStyleProps } from './style-props/parse-style-props/parse-style-props.mjs';
import { useRandomClassName } from './use-random-classname/use-random-classname.mjs';

const _Box = forwardRef(
  ({
    component,
    style,
    __vars,
    className,
    variant,
    mod,
    size,
    hiddenFrom,
    visibleFrom,
    lightHidden,
    darkHidden,
    renderRoot,
    __size,
    ...others
  }, ref) => {
    const theme = useMantineTheme();
    const Element = component || "div";
    const { styleProps, rest } = extractStyleProps(others);
    const useSxTransform = useMantineSxTransform();
    const transformedSx = useSxTransform?.()?.(styleProps.sx);
    const responsiveClassName = useRandomClassName();
    const parsedStyleProps = parseStyleProps({
      styleProps,
      theme,
      data: STYlE_PROPS_DATA
    });
    const props = {
      ref,
      style: getBoxStyle({
        theme,
        style,
        vars: __vars,
        styleProps: parsedStyleProps.inlineStyles
      }),
      className: cx(className, transformedSx, {
        [responsiveClassName]: parsedStyleProps.hasResponsiveStyles,
        "mantine-light-hidden": lightHidden,
        "mantine-dark-hidden": darkHidden,
        [`mantine-hidden-from-${hiddenFrom}`]: hiddenFrom,
        [`mantine-visible-from-${visibleFrom}`]: visibleFrom
      }),
      "data-variant": variant,
      "data-size": isNumberLike(size) ? void 0 : size || void 0,
      size: __size,
      ...getBoxMod(mod),
      ...rest
    };
    return /* @__PURE__ */ jsxs(Fragment, { children: [
      parsedStyleProps.hasResponsiveStyles && /* @__PURE__ */ jsx(
        InlineStyles,
        {
          selector: `.${responsiveClassName}`,
          styles: parsedStyleProps.styles,
          media: parsedStyleProps.media
        }
      ),
      typeof renderRoot === "function" ? renderRoot(props) : /* @__PURE__ */ jsx(Element, { ...props })
    ] });
  }
);
_Box.displayName = "@mantine/core/Box";
const Box = createPolymorphicComponent(_Box);

export { Box };
//# sourceMappingURL=Box.mjs.map
