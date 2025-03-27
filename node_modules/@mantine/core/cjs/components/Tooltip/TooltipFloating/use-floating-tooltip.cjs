'use client';
'use strict';

var React = require('react');
var react = require('@floating-ui/react');

function useFloatingTooltip({
  offset,
  position,
  defaultOpened
}) {
  const [opened, setOpened] = React.useState(defaultOpened);
  const boundaryRef = React.useRef(null);
  const { x, y, elements, refs, update, placement } = react.useFloating({
    placement: position,
    middleware: [
      react.shift({
        crossAxis: true,
        padding: 5,
        rootBoundary: "document"
      })
    ]
  });
  const horizontalOffset = placement.includes("right") ? offset : position.includes("left") ? offset * -1 : 0;
  const verticalOffset = placement.includes("bottom") ? offset : position.includes("top") ? offset * -1 : 0;
  const handleMouseMove = React.useCallback(
    ({ clientX, clientY }) => {
      refs.setPositionReference({
        getBoundingClientRect() {
          return {
            width: 0,
            height: 0,
            x: clientX,
            y: clientY,
            left: clientX + horizontalOffset,
            top: clientY + verticalOffset,
            right: clientX,
            bottom: clientY
          };
        }
      });
    },
    [elements.reference]
  );
  React.useEffect(() => {
    if (refs.floating.current) {
      const boundary = boundaryRef.current;
      boundary.addEventListener("mousemove", handleMouseMove);
      const parents = react.getOverflowAncestors(refs.floating.current);
      parents.forEach((parent) => {
        parent.addEventListener("scroll", update);
      });
      return () => {
        boundary.removeEventListener("mousemove", handleMouseMove);
        parents.forEach((parent) => {
          parent.removeEventListener("scroll", update);
        });
      };
    }
    return void 0;
  }, [elements.reference, refs.floating.current, update, handleMouseMove, opened]);
  return { handleMouseMove, x, y, opened, setOpened, boundaryRef, floating: refs.setFloating };
}

exports.useFloatingTooltip = useFloatingTooltip;
//# sourceMappingURL=use-floating-tooltip.cjs.map
