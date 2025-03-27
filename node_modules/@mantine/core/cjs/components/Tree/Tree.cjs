'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var hooks = require('@mantine/hooks');
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
var TreeNode = require('./TreeNode.cjs');
var useTree = require('./use-tree.cjs');
var Tree_module = require('./Tree.module.css.cjs');

function getFlatValues(data) {
  return data.reduce((acc, item) => {
    acc.push(item.value);
    if (item.children) {
      acc.push(...getFlatValues(item.children));
    }
    return acc;
  }, []);
}
const defaultProps = {
  expandOnClick: true,
  allowRangeSelection: true,
  expandOnSpace: true
};
const varsResolver = createVarsResolver.createVarsResolver((_theme, { levelOffset }) => ({
  root: {
    "--level-offset": getSize.getSpacing(levelOffset)
  }
}));
const Tree = factory.factory((_props, ref) => {
  const props = useProps.useProps("Tree", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    data,
    expandOnClick,
    tree,
    renderNode,
    selectOnClick,
    clearSelectionOnOutsideClick,
    allowRangeSelection,
    expandOnSpace,
    levelOffset,
    checkOnSpace,
    ...others
  } = props;
  const defaultController = useTree.useTree();
  const controller = tree || defaultController;
  const getStyles = useStyles.useStyles({
    name: "Tree",
    classes: Tree_module,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  const clickOutsideRef = hooks.useClickOutside(
    () => clearSelectionOnOutsideClick && controller.clearSelected()
  );
  const mergedRef = hooks.useMergedRef(ref, clickOutsideRef);
  const flatValues = React.useMemo(() => getFlatValues(data), [data]);
  React.useEffect(() => {
    controller.initialize(data);
  }, [data]);
  const nodes = data.map((node, index) => /* @__PURE__ */ jsxRuntime.jsx(
    TreeNode.TreeNode,
    {
      node,
      getStyles,
      rootIndex: index,
      expandOnClick,
      selectOnClick,
      controller,
      renderNode,
      flatValues,
      allowRangeSelection,
      expandOnSpace,
      checkOnSpace
    },
    node.value
  ));
  return /* @__PURE__ */ jsxRuntime.jsx(
    Box.Box,
    {
      component: "ul",
      ref: mergedRef,
      ...getStyles("root"),
      ...others,
      role: "tree",
      "aria-multiselectable": controller.multiple,
      "data-tree-root": true,
      children: nodes
    }
  );
});
Tree.displayName = "@mantine/core/Tree";
Tree.classes = Tree_module;

exports.Tree = Tree;
//# sourceMappingURL=Tree.cjs.map
