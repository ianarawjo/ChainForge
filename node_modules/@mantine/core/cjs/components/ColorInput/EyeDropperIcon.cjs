'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');

function EyeDropperIcon({ style, ...others }) {
  return /* @__PURE__ */ jsxRuntime.jsxs(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      style: {
        width: "var(--ci-eye-dropper-icon-size)",
        height: "var(--ci-eye-dropper-icon-size)",
        ...style
      },
      viewBox: "0 0 24 24",
      strokeWidth: "1.5",
      stroke: "currentColor",
      fill: "none",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      ...others,
      children: [
        /* @__PURE__ */ jsxRuntime.jsx("path", { stroke: "none", d: "M0 0h24v24H0z", fill: "none" }),
        /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M11 7l6 6" }),
        /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M4 16l11.7 -11.7a1 1 0 0 1 1.4 0l2.6 2.6a1 1 0 0 1 0 1.4l-11.7 11.7h-4v-4z" })
      ]
    }
  );
}

exports.EyeDropperIcon = EyeDropperIcon;
//# sourceMappingURL=EyeDropperIcon.cjs.map
