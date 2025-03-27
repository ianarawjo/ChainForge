'use client';
'use strict';

var hooks = require('@mantine/hooks');

function useResizeObserver(element, onResize) {
  const handleResize = hooks.useCallbackRef(onResize);
  hooks.useIsomorphicEffect(() => {
    let rAF = 0;
    if (element) {
      const resizeObserver = new ResizeObserver(() => {
        cancelAnimationFrame(rAF);
        rAF = window.requestAnimationFrame(handleResize);
      });
      resizeObserver.observe(element);
      return () => {
        window.cancelAnimationFrame(rAF);
        resizeObserver.unobserve(element);
      };
    }
    return void 0;
  }, [element, handleResize]);
}

exports.useResizeObserver = useResizeObserver;
//# sourceMappingURL=use-resize-observer.cjs.map
