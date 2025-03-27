'use client';
'use strict';

var cx = require('clsx');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var cx__default = /*#__PURE__*/_interopDefault(cx);

const FOCUS_CLASS_NAMES = {
  always: "mantine-focus-always",
  auto: "mantine-focus-auto",
  never: "mantine-focus-never"
};
function getGlobalClassNames({ theme, options, unstyled }) {
  return cx__default.default(
    options?.focusable && !unstyled && (theme.focusClassName || FOCUS_CLASS_NAMES[theme.focusRing]),
    options?.active && !unstyled && theme.activeClassName
  );
}

exports.FOCUS_CLASS_NAMES = FOCUS_CLASS_NAMES;
exports.getGlobalClassNames = getGlobalClassNames;
//# sourceMappingURL=get-global-class-names.cjs.map
