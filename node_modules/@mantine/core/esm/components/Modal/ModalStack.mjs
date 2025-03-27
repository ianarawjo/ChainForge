'use client';
import { jsx } from 'react/jsx-runtime';
import { useState } from 'react';
import { createOptionalContext } from '../../core/utils/create-optional-context/create-optional-context.mjs';
import { getDefaultZIndex } from '../../core/utils/get-default-z-index/get-default-z-index.mjs';
import '@mantine/hooks';
import 'clsx';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../core/Box/Box.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';

const [ModalStackProvider, useModalStackContext] = createOptionalContext();
function ModalStack({ children }) {
  const [stack, setStack] = useState([]);
  const [maxZIndex, setMaxZIndex] = useState(getDefaultZIndex("modal"));
  return /* @__PURE__ */ jsx(
    ModalStackProvider,
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
ModalStack.displayName = "@mantine/core/ModalStack";

export { ModalStack, useModalStackContext };
//# sourceMappingURL=ModalStack.mjs.map
