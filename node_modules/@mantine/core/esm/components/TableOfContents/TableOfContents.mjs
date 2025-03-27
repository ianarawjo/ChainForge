'use client';
import { jsx } from 'react/jsx-runtime';
import { useId, useScrollSpy, assignRef } from '@mantine/hooks';
import { rem } from '../../core/utils/units-converters/rem.mjs';
import 'react';
import { getFontSize, getRadius } from '../../core/utils/get-size/get-size.mjs';
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
import { UnstyledButton } from '../UnstyledButton/UnstyledButton.mjs';
import classes from './TableOfContents.module.css.mjs';

const defaultProps = {
  getControlProps: ({ data }) => ({
    children: data.value
  })
};
const varsResolver = createVarsResolver(
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
        "--toc-size": getFontSize(size),
        "--toc-depth-offset": rem(depthOffset),
        "--toc-radius": getRadius(radius)
      }
    };
  }
);
const TableOfContents = factory((_props, ref) => {
  const props = useProps("TableOfContents", defaultProps, _props);
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
  const getStyles = useStyles({
    name: "TableOfContents",
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
  const idBase = useId();
  const spy = useScrollSpy(scrollSpyOptions);
  assignRef(reinitializeRef, spy.reinitialize);
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
    return /* @__PURE__ */ jsx(
      UnstyledButton,
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
  return /* @__PURE__ */ jsx(Box, { ref, variant, ...getStyles("root"), ...others, children: controls });
});
TableOfContents.displayName = "@mantine/core/TableOfContents";
TableOfContents.classes = classes;

export { TableOfContents };
//# sourceMappingURL=TableOfContents.mjs.map
