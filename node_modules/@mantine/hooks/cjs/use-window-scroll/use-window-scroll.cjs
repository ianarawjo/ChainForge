'use client';
'use strict';

var React = require('react');
var useWindowEvent = require('../use-window-event/use-window-event.cjs');

function getScrollPosition() {
  return typeof window !== "undefined" ? { x: window.pageXOffset, y: window.pageYOffset } : { x: 0, y: 0 };
}
function scrollTo({ x, y }) {
  if (typeof window !== "undefined") {
    const scrollOptions = { behavior: "smooth" };
    if (typeof x === "number") {
      scrollOptions.left = x;
    }
    if (typeof y === "number") {
      scrollOptions.top = y;
    }
    window.scrollTo(scrollOptions);
  }
}
function useWindowScroll() {
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  useWindowEvent.useWindowEvent("scroll", () => setPosition(getScrollPosition()));
  useWindowEvent.useWindowEvent("resize", () => setPosition(getScrollPosition()));
  React.useEffect(() => {
    setPosition(getScrollPosition());
  }, []);
  return [position, scrollTo];
}

exports.useWindowScroll = useWindowScroll;
//# sourceMappingURL=use-window-scroll.cjs.map
