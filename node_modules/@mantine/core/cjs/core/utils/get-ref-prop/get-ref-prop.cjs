'use client';
'use strict';

var React = require('react');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var React__default = /*#__PURE__*/_interopDefault(React);

function getRefProp(element) {
  const version = React__default.default.version;
  if (typeof React__default.default.version !== "string") {
    return element?.ref;
  }
  if (version.startsWith("18.")) {
    return element?.ref;
  }
  return element?.props?.ref;
}

exports.getRefProp = getRefProp;
//# sourceMappingURL=get-ref-prop.cjs.map
