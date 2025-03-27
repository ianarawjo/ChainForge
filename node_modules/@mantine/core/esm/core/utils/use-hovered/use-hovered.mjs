'use client';
import { useState } from 'react';

function useHovered() {
  const [hovered, setHovered] = useState(-1);
  const resetHovered = () => setHovered(-1);
  return [hovered, { setHovered, resetHovered }];
}

export { useHovered };
//# sourceMappingURL=use-hovered.mjs.map
