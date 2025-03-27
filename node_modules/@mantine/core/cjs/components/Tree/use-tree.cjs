'use client';
'use strict';

var React = require('react');
var getAllCheckedNodes = require('./get-all-checked-nodes/get-all-checked-nodes.cjs');
var getChildrenNodesValues = require('./get-children-nodes-values/get-children-nodes-values.cjs');
var isNodeChecked = require('./is-node-checked/is-node-checked.cjs');
var isNodeIndeterminate = require('./is-node-indeterminate/is-node-indeterminate.cjs');

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
  initialState.forEach((node) => acc.push(...getChildrenNodesValues.getChildrenNodesValues(node, data)));
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
  const [data, setData] = React.useState([]);
  const [expandedState, setExpandedState] = React.useState(initialExpandedState);
  const [selectedState, setSelectedState] = React.useState(initialSelectedState);
  const [checkedState, setCheckedState] = React.useState(initialCheckedState);
  const [anchorNode, setAnchorNode] = React.useState(null);
  const [hoveredNode, setHoveredNode] = React.useState(null);
  const initialize = React.useCallback(
    (_data) => {
      setExpandedState((current) => getInitialTreeExpandedState(current, _data, selectedState));
      setCheckedState((current) => getInitialCheckedState(current, _data));
      setData(_data);
    },
    [selectedState, checkedState]
  );
  const toggleExpanded = React.useCallback(
    (value) => {
      setExpandedState((current) => {
        const nextState = { ...current, [value]: !current[value] };
        nextState[value] ? onNodeExpand?.(value) : onNodeCollapse?.(value);
        return nextState;
      });
    },
    [onNodeCollapse, onNodeExpand]
  );
  const collapse = React.useCallback(
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
  const expand = React.useCallback(
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
  const expandAllNodes = React.useCallback(() => {
    setExpandedState((current) => {
      const next = { ...current };
      Object.keys(next).forEach((key) => {
        next[key] = true;
      });
      return next;
    });
  }, []);
  const collapseAllNodes = React.useCallback(() => {
    setExpandedState((current) => {
      const next = { ...current };
      Object.keys(next).forEach((key) => {
        next[key] = false;
      });
      return next;
    });
  }, []);
  const toggleSelected = React.useCallback(
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
  const select = React.useCallback((value) => {
    setAnchorNode(value);
    setSelectedState(
      (current) => multiple ? current.includes(value) ? current : [...current, value] : [value]
    );
  }, []);
  const deselect = React.useCallback((value) => {
    anchorNode === value && setAnchorNode(null);
    setSelectedState((current) => current.filter((item) => item !== value));
  }, []);
  const clearSelected = React.useCallback(() => {
    setSelectedState([]);
    setAnchorNode(null);
  }, []);
  const checkNode = React.useCallback(
    (value) => {
      const checkedNodes = getChildrenNodesValues.getChildrenNodesValues(value, data);
      setCheckedState((current) => Array.from(/* @__PURE__ */ new Set([...current, ...checkedNodes])));
    },
    [data]
  );
  const uncheckNode = React.useCallback(
    (value) => {
      const checkedNodes = getChildrenNodesValues.getChildrenNodesValues(value, data);
      setCheckedState((current) => current.filter((item) => !checkedNodes.includes(item)));
    },
    [data]
  );
  const checkAllNodes = React.useCallback(() => {
    setCheckedState(() => getChildrenNodesValues.getAllChildrenNodes(data));
  }, [data]);
  const uncheckAllNodes = React.useCallback(() => {
    setCheckedState([]);
  }, []);
  const getCheckedNodes = () => getAllCheckedNodes.getAllCheckedNodes(data, checkedState).result;
  const isNodeChecked$1 = (value) => isNodeChecked.memoizedIsNodeChecked(value, data, checkedState);
  const isNodeIndeterminate$1 = (value) => isNodeIndeterminate.memoizedIsNodeIndeterminate(value, data, checkedState);
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
    isNodeChecked: isNodeChecked$1,
    isNodeIndeterminate: isNodeIndeterminate$1
  };
}

exports.getTreeExpandedState = getTreeExpandedState;
exports.useTree = useTree;
//# sourceMappingURL=use-tree.cjs.map
