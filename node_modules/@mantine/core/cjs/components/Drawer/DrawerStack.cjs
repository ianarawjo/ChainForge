'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
var createOptionalContext = require('../../core/utils/create-optional-context/create-optional-context.cjs');
var getDefaultZIndex = require('../../core/utils/get-default-z-index/get-default-z-index.cjs');
require('@mantine/hooks');
require('clsx');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
require('../../core/Box/Box.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');

const [DrawerStackProvider, useDrawerStackContext] = createOptionalContext.createOptionalContext();
function DrawerStack({ children }) {
  const [stack, setStack] = React.useState([]);
  const [maxZIndex, setMaxZIndex] = React.useState(getDefaultZIndex.getDefaultZIndex("modal"));
  return /* @__PURE__ */ jsxRuntime.jsx(
    DrawerStackProvider,
    {
      value: {
        stack,
        addModal: (id, zIndex) => {
          setStack((current) => [.../* @__PURE__ */ new Set([...current, id])]);
          setMaxZIndex(
            (current) => typeof zIndex === "number" && typeof current === "number" ? Math.max(current, zIndex) : current
          );
        },
        removeModal: (id) => setStack((current) => current.filter((currentId) => currentId !== id)),
        getZIndex: (id) => `calc(${maxZIndex} + ${stack.indexOf(id)} + 1)`,
        currentId: stack[stack.length - 1],
        maxZIndex
      },
      children
    }
  );
}
DrawerStack.displayName = "@mantine/core/DrawerStack";

exports.DrawerStack = DrawerStack;
exports.useDrawerStackContext = useDrawerStackContext;
//# sourceMappingURL=DrawerStack.cjs.map
