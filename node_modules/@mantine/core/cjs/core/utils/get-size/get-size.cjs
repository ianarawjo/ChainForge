'use client';
'use strict';

var isNumberLike = require('../is-number-like/is-number-like.cjs');
var rem = require('../units-converters/rem.cjs');

function getSize(size, prefix = "size", convertToRem = true) {
  if (size === void 0) {
    return void 0;
  }
  return isNumberLike.isNumberLike(size) ? convertToRem ? rem.rem(size) : size : `var(--${prefix}-${size})`;
}
function getSpacing(size) {
  return getSize(size, "mantine-spacing");
}
function getRadius(size) {
  if (size === void 0) {
    return "var(--mantine-radius-default)";
  }
  return getSize(size, "mantine-radius");
}
function getFontSize(size) {
  return getSize(size, "mantine-font-size");
}
function getLineHeight(size) {
  return getSize(size, "mantine-line-height", false);
}
function getShadow(size) {
  if (!size) {
    return void 0;
  }
  return getSize(size, "mantine-shadow", false);
}

exports.getFontSize = getFontSize;
exports.getLineHeight = getLineHeight;
exports.getRadius = getRadius;
exports.getShadow = getShadow;
exports.getSize = getSize;
exports.getSpacing = getSpacing;
//# sourceMappingURL=get-size.cjs.map
