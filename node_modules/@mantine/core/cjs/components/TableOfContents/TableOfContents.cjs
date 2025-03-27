'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var hooks = require('@mantine/hooks');
var rem = require('../../core/utils/units-converters/rem.cjs');
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
var UnstyledButton = require('../UnstyledButton/UnstyledButton.cjs');
var TableOfContents_module = require('./TableOfContents.module.css.cjs');

const defaultProps = {
  getControlProps: ({ data }) => ({
    children: data.value
  })
};
const varsResolver = createVarsResolver.createVarsResolver(
  (theme, { color, size, variant, autoContrast, depthOffset, radius }) => {
    const colors = theme.variantColorResolver({
      color: color || theme.primaryColor,
      theme,
      variant: variant || "filled",
      autoContrast
    });
    return {
      root: {
        "--toc-bg": variant !== "none" ? colors.background : void 0,
        "--toc-color": variant !== "none" ? colors.color : void 0,
        "--toc-size": getSize.getFontSize(size),
        "--toc-depth-offset": rem.rem(depthOffset),
        "--toc-radius": getSize.getRadius(radius)
      }
    };
  }
);
const TableOfContents = factory.factory((_props, ref) => {
  const props = useProps.useProps("TableOfContents", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    color,
    autoContrast,
    scrollSpyOptions,
    initialData,
    getControlProps,
    minDepthToOffset,
    depthOffset,
    variant,
    radius,
    reinitializeRef,
    ...others
  } = props;
  const getStyles = useStyles.useStyles({
    name: "TableOfContents",
    classes: TableOfContents_module,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  const idBase = hooks.useId();
  const spy = hooks.useScrollSpy(scrollSpyOptions);
  hooks.assignRef(reinitializeRef, spy.reinitialize);
  const headingsData = spy.initialized ? spy.data : initialData || [];
  const controls = headingsData.map((data, index) => {
    const controlProps = getControlProps?.({
      active: index === spy.active,
      data: {
        ...data,
        getNode: data.getNode || (() => {
        })
      }
    });
    return /* @__PURE__ */ jsxRuntime.jsx(
      UnstyledButton.UnstyledButton,
      {
        __vars: { "--depth-offset": `${data.depth - (minDepthToOffset || 1)}` },
        "data-active": index === spy.active || void 0,
        variant,
        ...controlProps,
        ...getStyles("control", {
          className: controlProps?.className,
          style: controlProps?.style
        })
      },
      data.id || `${idBase}-${index}`
    );
  });
  return /* @__PURE__ */ jsxRuntime.jsx(Box.Box, { ref, variant, ...getStyles("root"), ...others, children: controls });
});
TableOfContents.displayName = "@mantine/core/TableOfContents";
TableOfContents.classes = TableOfContents_module;

exports.TableOfContents = TableOfContents;
//# sourceMappingURL=TableOfContents.cjs.map
