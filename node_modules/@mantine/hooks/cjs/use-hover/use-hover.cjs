'use client';
'use strict';

var React = require('react');

function useHover() {
  const [hovered, setHovered] = React.useState(false);
  const ref = React.useRef(null);
  const onMouseEnter = React.useCallback(() => setHovered(true), []);
  const onMouseLeave = React.useCallback(() => setHovered(false), []);
  React.useEffect(() => {
    const node = ref.current;
    if (node) {
      node.addEventListener("mouseenter", onMouseEnter);
      node.addEventListener("mouseleave", onMouseLeave);
      return () => {
        node?.removeEventListener("mouseenter", onMouseEnter);
        node?.removeEventListener("mouseleave", onMouseLeave);
      };
    }
    return void 0;
  }, [ref.current]);
  return { ref, hovered };
}

exports.useHover = useHover;
//# sourceMappingURL=use-hover.cjs.map
