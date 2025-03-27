'use client';
import { jsx } from 'react/jsx-runtime';
import { createContext, useContext, useState } from 'react';
import { useIsomorphicEffect } from '@mantine/hooks';

const DirectionContext = createContext({
  dir: "ltr",
  toggleDirection: () => {
  },
  setDirection: () => {
  }
});
function useDirection() {
  return useContext(DirectionContext);
}
function DirectionProvider({
  children,
  initialDirection = "ltr",
  detectDirection = true
}) {
  const [dir, setDir] = useState(initialDirection);
  const setDirection = (direction) => {
    setDir(direction);
    document.documentElement.setAttribute("dir", direction);
  };
  const toggleDirection = () => setDirection(dir === "ltr" ? "rtl" : "ltr");
  useIsomorphicEffect(() => {
    if (detectDirection) {
      const direction = document.documentElement.getAttribute("dir");
      if (direction === "rtl" || direction === "ltr") {
        setDirection(direction);
      }
    }
  }, []);
  return /* @__PURE__ */ jsx(DirectionContext.Provider, { value: { dir, toggleDirection, setDirection }, children });
}

export { DirectionContext, DirectionProvider, useDirection };
//# sourceMappingURL=DirectionProvider.mjs.map
