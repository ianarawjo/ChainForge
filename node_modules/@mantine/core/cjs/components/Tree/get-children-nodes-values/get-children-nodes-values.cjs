'use client';
'use strict';

function findTreeNode(value, data) {
  for (const node of data) {
    if (node.value === value) {
      return node;
    }
    if (Array.isArray(node.children)) {
      const childNode = findTreeNode(value, node.children);
      if (childNode) {
        return childNode;
      }
    }
  }
  return null;
}
function getChildrenNodesValues(value, data, acc = []) {
  const node = findTreeNode(value, data);
  if (!node) {
    return acc;
  }
  if (!Array.isArray(node.children) || node.children.length === 0) {
    return [node.value];
  }
  node.children.forEach((child) => {
    if (Array.isArray(child.children) && child.children.length > 0) {
      getChildrenNodesValues(child.value, data, acc);
    } else {
      acc.push(child.value);
    }
  });
  return acc;
}
function getAllChildrenNodes(data) {
  return data.reduce((acc, node) => {
    if (Array.isArray(node.children) && node.children.length > 0) {
      acc.push(...getAllChildrenNodes(node.children));
    } else {
      acc.push(node.value);
    }
    return acc;
  }, []);
}

exports.findTreeNode = findTreeNode;
exports.getAllChildrenNodes = getAllChildrenNodes;
exports.getChildrenNodesValues = getChildrenNodesValues;
//# sourceMappingURL=get-children-nodes-values.cjs.map
