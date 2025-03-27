'use client';
import { jsx, jsxs } from 'react/jsx-runtime';
import { useRef } from 'react';
import { findElementAncestor } from '../../core/utils/find-element-ancestor/find-element-ancestor.mjs';
import '@mantine/hooks';
import 'clsx';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../core/Box/Box.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';

function getValuesRange(anchor, value, flatValues) {
  if (!anchor || !value) {
    return [];
  }
  const anchorIndex = flatValues.indexOf(anchor);
  const valueIndex = flatValues.indexOf(value);
  const start = Math.min(anchorIndex, valueIndex);
  const end = Math.max(anchorIndex, valueIndex);
  return flatValues.slice(start, end + 1);
}
function TreeNode({
  node,
  getStyles,
  rootIndex,
  controller,
  expandOnClick,
  selectOnClick,
  isSubtree,
  level = 1,
  renderNode,
  flatValues,
  allowRangeSelection,
  expandOnSpace,
  checkOnSpace
}) {
  const ref = useRef(null);
  const nested = (node.children || []).map((child) => /* @__PURE__ */ jsx(
    TreeNode,
    {
      node: child,
      flatValues,
      getStyles,
      rootIndex: void 0,
      level: level + 1,
      controller,
      expandOnClick,
      isSubtree: true,
      renderNode,
      selectOnClick,
      allowRangeSelection,
      expandOnSpace,
      checkOnSpace
    },
    child.value
  ));
  const handleKeyDown = (event) => {
    if (event.nativeEvent.code === "ArrowRight") {
      event.stopPropagation();
      event.preventDefault();
      if (controller.expandedState[node.value]) {
        event.currentTarget.querySelector("[role=treeitem]")?.focus();
      } else {
        controller.expand(node.value);
      }
    }
    if (event.nativeEvent.code === "ArrowLeft") {
      event.stopPropagation();
      event.preventDefault();
      if (controller.expandedState[node.value] && (node.children || []).length > 0) {
        controller.collapse(node.value);
      } else if (isSubtree) {
        findElementAncestor(event.currentTarget, "[role=treeitem]")?.focus();
      }
    }
    if (event.nativeEvent.code === "ArrowDown" || event.nativeEvent.code === "ArrowUp") {
      const root = findElementAncestor(event.currentTarget, "[data-tree-root]");
      if (!root) {
        return;
      }
      event.stopPropagation();
      event.preventDefault();
      const nodes = Array.from(root.querySelectorAll("[role=treeitem]"));
      const index = nodes.indexOf(event.currentTarget);
      if (index === -1) {
        return;
      }
      const nextIndex = event.nativeEvent.code === "ArrowDown" ? index + 1 : index - 1;
      nodes[nextIndex]?.focus();
      if (event.shiftKey) {
        const selectNode = nodes[nextIndex];
        if (selectNode) {
          controller.setSelectedState(
            getValuesRange(controller.anchorNode, selectNode.dataset.value, flatValues)
          );
        }
      }
    }
    if (event.nativeEvent.code === "Space") {
      if (expandOnSpace) {
        event.stopPropagation();
        event.preventDefault();
        controller.toggleExpanded(node.value);
      }
      if (checkOnSpace) {
        event.stopPropagation();
        event.preventDefault();
        controller.isNodeChecked(node.value) ? controller.uncheckNode(node.value) : controller.checkNode(node.value);
      }
    }
  };
  const handleNodeClick = (event) => {
    event.stopPropagation();
    if (allowRangeSelection && event.shiftKey && controller.anchorNode) {
      controller.setSelectedState(getValuesRange(controller.anchorNode, node.value, flatValues));
      ref.current?.focus();
    } else {
      expandOnClick && controller.toggleExpanded(node.value);
      selectOnClick && controller.select(node.value);
      ref.current?.focus();
    }
  };
  const selected = controller.selectedState.includes(node.value);
  const elementProps = {
    ...getStyles("label"),
    onClick: handleNodeClick,
    "data-selected": selected || void 0,
    "data-value": node.value,
    "data-hovered": controller.hoveredNode === node.value || void 0
  };
  return /* @__PURE__ */ jsxs(
    "li",
    {
      ...getStyles("node", {
        style: { "--label-offset": `calc(var(--level-offset) * ${level - 1})` }
      }),
      role: "treeitem",
      "aria-selected": selected,
      "data-value": node.value,
      "data-selected": selected || void 0,
      "data-hovered": controller.hoveredNode === node.value || void 0,
      "data-level": level,
      tabIndex: rootIndex === 0 ? 0 : -1,
      onKeyDown: handleKeyDown,
      ref,
      onMouseOver: (event) => {
        event.stopPropagation();
        controller.setHoveredNode(node.value);
      },
      onMouseLeave: (event) => {
        event.stopPropagation();
        controller.setHoveredNode(null);
      },
      children: [
        typeof renderNode === "function" ? renderNode({
          node,
          level,
          selected,
          tree: controller,
          expanded: controller.expandedState[node.value] || false,
          hasChildren: Array.isArray(node.children) && node.children.length > 0,
          elementProps
        }) : /* @__PURE__ */ jsx("div", { ...elementProps, children: node.label }),
        controller.expandedState[node.value] && nested.length > 0 && /* @__PURE__ */ jsx("ul", { role: "group", ...getStyles("subtree"), "data-level": level, children: nested })
      ]
    }
  );
}
TreeNode.displayName = "@mantine/core/TreeNode";

export { TreeNode };
//# sourceMappingURL=TreeNode.mjs.map
