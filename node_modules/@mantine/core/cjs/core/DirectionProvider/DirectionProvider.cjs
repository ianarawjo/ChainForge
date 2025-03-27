'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var hooks = require('@mantine/hooks');

const DirectionContext = React.createContext({
  dir: "ltr",
  toggleDirection: () => {
  },
  setDirection: () => {
  }
});
function useDirection() {
  return React.useContext(DirectionContext);
}
function DirectionProvider({
  children,
  initialDirection = "ltr",
  detectDirection = true
}) {
  const [dir, setDir] = React.useState(initialDirection);
  const setDirection = (direction) => {
    setDir(direction);
    document.documentElement.setAttribute("dir", direction);
  };
  const toggleDirection = () => setDirection(dir === "ltr" ? "rtl" : "ltr");
  hooks.useIsomorphicEffect(() => {
    if (detectDirection) {
      const direction = document.documentElement.getAttribute("dir");
      if (direction === "rtl" || direction === "ltr") {
        setDirection(direction);
      }
    }
  }, []);
  return /* @__PURE__ */ jsxRuntime.jsx(DirectionContext.Provider, { value: { dir, toggleDirection, setDirection }, children });
}

exports.DirectionContext = DirectionContext;
exports.DirectionProvider = DirectionProvider;
exports.useDirection = useDirection;
//# sourceMappingURL=DirectionProvider.cjs.map
