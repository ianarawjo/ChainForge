'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var cx = require('clsx');
var createPolymorphicComponent = require('../factory/create-polymorphic-component.cjs');
var InlineStyles = require('../InlineStyles/InlineStyles.cjs');
var isNumberLike = require('../utils/is-number-like/is-number-like.cjs');
require('@mantine/hooks');
var Mantine_context = require('../MantineProvider/Mantine.context.cjs');
require('../MantineProvider/default-theme.cjs');
require('../MantineProvider/MantineProvider.cjs');
var MantineThemeProvider = require('../MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
require('../MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var getBoxMod = require('./get-box-mod/get-box-mod.cjs');
var getBoxStyle = require('./get-box-style/get-box-style.cjs');
var extractStyleProps = require('./style-props/extract-style-props/extract-style-props.cjs');
var stylePropsData = require('./style-props/style-props-data.cjs');
var parseStyleProps = require('./style-props/parse-style-props/parse-style-props.cjs');
var useRandomClassname = require('./use-random-classname/use-random-classname.cjs');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var cx__default = /*#__PURE__*/_interopDefault(cx);

const _Box = React.forwardRef(
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
    const theme = MantineThemeProvider.useMantineTheme();
    const Element = component || "div";
    const { styleProps, rest } = extractStyleProps.extractStyleProps(others);
    const useSxTransform = Mantine_context.useMantineSxTransform();
    const transformedSx = useSxTransform?.()?.(styleProps.sx);
    const responsiveClassName = useRandomClassname.useRandomClassName();
    const parsedStyleProps = parseStyleProps.parseStyleProps({
      styleProps,
      theme,
      data: stylePropsData.STYlE_PROPS_DATA
    });
    const props = {
      ref,
      style: getBoxStyle.getBoxStyle({
        theme,
        style,
        vars: __vars,
        styleProps: parsedStyleProps.inlineStyles
      }),
      className: cx__default.default(className, transformedSx, {
        [responsiveClassName]: parsedStyleProps.hasResponsiveStyles,
        "mantine-light-hidden": lightHidden,
        "mantine-dark-hidden": darkHidden,
        [`mantine-hidden-from-${hiddenFrom}`]: hiddenFrom,
        [`mantine-visible-from-${visibleFrom}`]: visibleFrom
      }),
      "data-variant": variant,
      "data-size": isNumberLike.isNumberLike(size) ? void 0 : size || void 0,
      size: __size,
      ...getBoxMod.getBoxMod(mod),
      ...rest
    };
    return /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
      parsedStyleProps.hasResponsiveStyles && /* @__PURE__ */ jsxRuntime.jsx(
        InlineStyles.InlineStyles,
        {
          selector: `.${responsiveClassName}`,
          styles: parsedStyleProps.styles,
          media: parsedStyleProps.media
        }
      ),
      typeof renderRoot === "function" ? renderRoot(props) : /* @__PURE__ */ jsxRuntime.jsx(Element, { ...props })
    ] });
  }
);
_Box.displayName = "@mantine/core/Box";
const Box = createPolymorphicComponent.createPolymorphicComponent(_Box);

exports.Box = Box;
//# sourceMappingURL=Box.cjs.map
