'use client';
'use strict';

var React = require('react');

function useInViewport() {
  const observer = React.useRef(null);
  const [inViewport, setInViewport] = React.useState(false);
  const ref = React.useCallback((node) => {
    if (typeof IntersectionObserver !== "undefined") {
      if (node && !observer.current) {
        observer.current = new IntersectionObserver(
          (entries) => setInViewport(entries.some((entry) => entry.isIntersecting))
        );
      } else {
        observer.current?.disconnect();
      }
      if (node) {
        observer.current?.observe(node);
      } else {
        setInViewport(false);
      }
    }
  }, []);
  return { ref, inViewport };
}

exports.useInViewport = useInViewport;
//# sourceMappingURL=use-in-viewport.cjs.map
