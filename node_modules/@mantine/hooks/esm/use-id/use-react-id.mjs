'use client';
import React from 'react';

const __useId = React["useId".toString()] || (() => void 0);
function useReactId() {
  const id = __useId();
  return id ? `mantine-${id.replace(/:/g, "")}` : "";
}

export { useReactId };
//# sourceMappingURL=use-react-id.mjs.map
