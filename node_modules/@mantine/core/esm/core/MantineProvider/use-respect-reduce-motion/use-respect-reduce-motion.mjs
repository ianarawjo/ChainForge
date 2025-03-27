'use client';
import { useIsomorphicEffect } from '@mantine/hooks';

function useRespectReduceMotion({
  respectReducedMotion,
  getRootElement
}) {
  useIsomorphicEffect(() => {
    if (respectReducedMotion) {
      getRootElement()?.setAttribute("data-respect-reduced-motion", "true");
    }
  }, [respectReducedMotion]);
}

export { useRespectReduceMotion };
//# sourceMappingURL=use-respect-reduce-motion.mjs.map
