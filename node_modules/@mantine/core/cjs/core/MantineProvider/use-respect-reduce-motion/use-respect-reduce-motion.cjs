'use client';
'use strict';

var hooks = require('@mantine/hooks');

function useRespectReduceMotion({
  respectReducedMotion,
  getRootElement
}) {
  hooks.useIsomorphicEffect(() => {
    if (respectReducedMotion) {
      getRootElement()?.setAttribute("data-respect-reduced-motion", "true");
    }
  }, [respectReducedMotion]);
}

exports.useRespectReduceMotion = useRespectReduceMotion;
//# sourceMappingURL=use-respect-reduce-motion.cjs.map
