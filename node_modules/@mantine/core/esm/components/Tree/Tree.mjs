'use client';
import { jsx } from 'react/jsx-runtime';
import { useMemo, useEffect } from 'react';
import { useClickOutside, useMergedRef } from '@mantine/hooks';
import { getSpacing } from '../../core/utils/get-size/get-size.mjs';
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
import { TreeNode } from './TreeNode.mjs';
import { useTree } from './use-tree.mjs';
import classes from './Tree.module.css.mjs';

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
const varsResolver = createVarsResolver((_theme, { levelOffset }) => ({
  root: {
    "--level-offset": getSpacing(levelOffset)
  }
}));
const Tree = factory((_props, ref) => {
  const props = useProps("Tree", defaultProps, _props);
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
  const defaultController = useTree();
  const controller = tree || defaultController;
  const getStyles = useStyles({
    name: "Tree",
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
  const clickOutsideRef = useClickOutside(
    () => clearSelectionOnOutsideClick && controller.clearSelected()
  );
  const mergedRef = useMergedRef(ref, clickOutsideRef);
  const flatValues = useMemo(() => getFlatValues(data), [data]);
  useEffect(() => {
    controller.initialize(data);
  }, [data]);
  const nodes = data.map((node, index) => /* @__PURE__ */ jsx(
    TreeNode,
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
  return /* @__PURE__ */ jsx(
    Box,
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
Tree.classes = classes;

export { Tree };
//# sourceMappingURL=Tree.mjs.map
