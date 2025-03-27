'use client';
'use strict';

var React = require('react');

function useIntersection(options) {
  const [entry, setEntry] = React.useState(null);
  const observer = React.useRef(null);
  const ref = React.useCallback(
    (element) => {
      if (observer.current) {
        observer.current.disconnect();
        observer.current = null;
      }
      if (element === null) {
        setEntry(null);
        return;
      }
      observer.current = new IntersectionObserver(([_entry]) => {
        setEntry(_entry);
      }, options);
      observer.current.observe(element);
    },
    [options?.rootMargin, options?.root, options?.threshold]
  );
  return { ref, entry };
}

exports.useIntersection = useIntersection;
//# sourceMappingURL=use-intersection.cjs.map
