'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
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
var factory = require('../../core/factory/factory.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
var filterFalsyChildren = require('./filter-falsy-children/filter-falsy-children.cjs');
var Group_module = require('./Group.module.css.cjs');

const defaultProps = {
  preventGrowOverflow: true,
  gap: "md",
  align: "center",
  justify: "flex-start",
  wrap: "wrap"
};
const varsResolver = createVarsResolver.createVarsResolver(
  (_, { grow, preventGrowOverflow, gap, align, justify, wrap }, { childWidth }) => ({
    root: {
      "--group-child-width": grow && preventGrowOverflow ? childWidth : void 0,
      "--group-gap": getSize.getSpacing(gap),
      "--group-align": align,
      "--group-justify": justify,
      "--group-wrap": wrap
    }
  })
);
const Group = factory.factory((_props, ref) => {
  const props = useProps.useProps("Group", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    children,
    gap,
    align,
    justify,
    wrap,
    grow,
    preventGrowOverflow,
    vars,
    variant,
    __size,
    mod,
    ...others
  } = props;
  const filteredChildren = filterFalsyChildren.filterFalsyChildren(children);
  const childrenCount = filteredChildren.length;
  const resolvedGap = getSize.getSpacing(gap ?? "md");
  const childWidth = `calc(${100 / childrenCount}% - (${resolvedGap} - ${resolvedGap} / ${childrenCount}))`;
  const stylesCtx = { childWidth };
  const getStyles = useStyles.useStyles({
    name: "Group",
    props,
    stylesCtx,
    className,
    style,
    classes: Group_module,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  return /* @__PURE__ */ jsxRuntime.jsx(
    Box.Box,
    {
      ...getStyles("root"),
      ref,
      variant,
      mod: [{ grow }, mod],
      size: __size,
      ...others,
      children: filteredChildren
    }
  );
});
Group.classes = Group_module;
Group.displayName = "@mantine/core/Group";

exports.Group = Group;
//# sourceMappingURL=Group.cjs.map
