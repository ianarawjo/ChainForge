'use client';
import { useState, useCallback } from 'react';
import { getAllCheckedNodes } from './get-all-checked-nodes/get-all-checked-nodes.mjs';
import { getChildrenNodesValues, getAllChildrenNodes } from './get-children-nodes-values/get-children-nodes-values.mjs';
import { memoizedIsNodeChecked } from './is-node-checked/is-node-checked.mjs';
import { memoizedIsNodeIndeterminate } from './is-node-indeterminate/is-node-indeterminate.mjs';

function getInitialTreeExpandedState(initialState, data, value, acc = {}) {
  data.forEach((node) => {
    acc[node.value] = node.value in initialState ? initialState[node.value] : node.value === value;
    if (Array.isArray(node.children)) {
      getInitialTreeExpandedState(initialState, node.children, value, acc);
    }
  });
  return acc;
}
function getTreeExpandedState(data, expandedNodesValues) {
  const state = getInitialTreeExpandedState({}, data, []);
  if (expandedNodesValues === "*") {
    return Object.keys(state).reduce((acc, key) => ({ ...acc, [key]: true }), {});
  }
  expandedNodesValues.forEach((node) => {
    state[node] = true;
  });
  return state;
}
function getInitialCheckedState(initialState, data) {
  const acc = [];
  initialState.forEach((node) => acc.push(...getChildrenNodesValues(node, data)));
  return Array.from(new Set(acc));
}
function useTree({
  initialSelectedState = [],
  initialCheckedState = [],
  initialExpandedState = {},
  multiple = false,
  onNodeCollapse,
  onNodeExpand
} = {}) {
  const [data, setData] = useState([]);
  const [expandedState, setExpandedState] = useState(initialExpandedState);
  const [selectedState, setSelectedState] = useState(initialSelectedState);
  const [checkedState, setCheckedState] = useState(initialCheckedState);
  const [anchorNode, setAnchorNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const initialize = useCallback(
    (_data) => {
      setExpandedState((current) => getInitialTreeExpandedState(current, _data, selectedState));
      setCheckedState((current) => getInitialCheckedState(current, _data));
      setData(_data);
    },
    [selectedState, checkedState]
  );
  const toggleExpanded = useCallback(
    (value) => {
      setExpandedState((current) => {
        const nextState = { ...current, [value]: !current[value] };
        nextState[value] ? onNodeExpand?.(value) : onNodeCollapse?.(value);
        return nextState;
      });
    },
    [onNodeCollapse, onNodeExpand]
  );
  const collapse = useCallback(
    (value) => {
      setExpandedState((current) => {
        if (current[value] !== false) {
          onNodeCollapse?.(value);
        }
        return { ...current, [value]: false };
      });
    },
    [onNodeCollapse]
  );
  const expand = useCallback(
    (value) => {
      setExpandedState((current) => {
        if (current[value] !== true) {
          onNodeExpand?.(value);
        }
        return { ...current, [value]: true };
      });
    },
    [onNodeExpand]
  );
  const expandAllNodes = useCallback(() => {
    setExpandedState((current) => {
      const next = { ...current };
      Object.keys(next).forEach((key) => {
        next[key] = true;
      });
      return next;
    });
  }, []);
  const collapseAllNodes = useCallback(() => {
    setExpandedState((current) => {
      const next = { ...current };
      Object.keys(next).forEach((key) => {
        next[key] = false;
      });
      return next;
    });
  }, []);
  const toggleSelected = useCallback(
    (value) => setSelectedState((current) => {
      if (!multiple) {
        if (current.includes(value)) {
          setAnchorNode(null);
          return [];
        }
        setAnchorNode(value);
        return [value];
      }
      if (current.includes(value)) {
        setAnchorNode(null);
        return current.filter((item) => item !== value);
      }
      setAnchorNode(value);
      return [...current, value];
    }),
    []
  );
  const select = useCallback((value) => {
    setAnchorNode(value);
    setSelectedState(
      (current) => multiple ? current.includes(value) ? current : [...current, value] : [value]
    );
  }, []);
  const deselect = useCallback((value) => {
    anchorNode === value && setAnchorNode(null);
    setSelectedState((current) => current.filter((item) => item !== value));
  }, []);
  const clearSelected = useCallback(() => {
    setSelectedState([]);
    setAnchorNode(null);
  }, []);
  const checkNode = useCallback(
    (value) => {
      const checkedNodes = getChildrenNodesValues(value, data);
      setCheckedState((current) => Array.from(/* @__PURE__ */ new Set([...current, ...checkedNodes])));
    },
    [data]
  );
  const uncheckNode = useCallback(
    (value) => {
      const checkedNodes = getChildrenNodesValues(value, data);
      setCheckedState((current) => current.filter((item) => !checkedNodes.includes(item)));
    },
    [data]
  );
  const checkAllNodes = useCallback(() => {
    setCheckedState(() => getAllChildrenNodes(data));
  }, [data]);
  const uncheckAllNodes = useCallback(() => {
    setCheckedState([]);
  }, []);
  const getCheckedNodes = () => getAllCheckedNodes(data, checkedState).result;
  const isNodeChecked = (value) => memoizedIsNodeChecked(value, data, checkedState);
  const isNodeIndeterminate = (value) => memoizedIsNodeIndeterminate(value, data, checkedState);
  return {
    multiple,
    expandedState,
    selectedState,
    checkedState,
    anchorNode,
    initialize,
    toggleExpanded,
    collapse,
    expand,
    expandAllNodes,
    collapseAllNodes,
    setExpandedState,
    checkNode,
    uncheckNode,
    checkAllNodes,
    uncheckAllNodes,
    setCheckedState,
    toggleSelected,
    select,
    deselect,
    clearSelected,
    setSelectedState,
    hoveredNode,
    setHoveredNode,
    getCheckedNodes,
    isNodeChecked,
    isNodeIndeterminate
  };
}

export { getTreeExpandedState, useTree };
//# sourceMappingURL=use-tree.mjs.map
