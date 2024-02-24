// StrictModeDroppable.tsx
// Credits to https://github.com/GiovanniACamacho and https://github.com/Meligy for the TypeScript version
// Original post: https://github.com/atlassian/react-beautiful-dnd/issues/2399#issuecomment-1175638194
import React, { useEffect, useState } from "react";
import { Droppable } from "react-beautiful-dnd";
export const StrictModeDroppable = ({ children, ...props }) => {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const animation = window.requestAnimationFrame(() => setEnabled(true));
    return () => {
      window.cancelAnimationFrame(animation);
      setEnabled(false);
    };
  }, []);
  if (!enabled) {
    return null;
  }
  return <Droppable {...props}>{children}</Droppable>;
};
