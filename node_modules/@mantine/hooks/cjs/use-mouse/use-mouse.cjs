'use client';
'use strict';

var React = require('react');

function useMouse(options = { resetOnExit: false }) {
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const ref = React.useRef(null);
  const setMousePosition = (event) => {
    if (ref.current) {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = Math.max(
        0,
        Math.round(event.pageX - rect.left - (window.pageXOffset || window.scrollX))
      );
      const y = Math.max(
        0,
        Math.round(event.pageY - rect.top - (window.pageYOffset || window.scrollY))
      );
      setPosition({ x, y });
    } else {
      setPosition({ x: event.clientX, y: event.clientY });
    }
  };
  const resetMousePosition = () => setPosition({ x: 0, y: 0 });
  React.useEffect(() => {
    const element = ref?.current ? ref.current : document;
    element.addEventListener("mousemove", setMousePosition);
    if (options.resetOnExit) {
      element.addEventListener("mouseleave", resetMousePosition);
    }
    return () => {
      element.removeEventListener("mousemove", setMousePosition);
      if (options.resetOnExit) {
        element.removeEventListener("mouseleave", resetMousePosition);
      }
    };
  }, [ref.current]);
  return { ref, ...position };
}

exports.useMouse = useMouse;
//# sourceMappingURL=use-mouse.cjs.map
