'use client';
import { useState, useRef, useEffect } from 'react';
import { randomId } from '../utils/random-id/random-id.mjs';

function getHeadingsData(headings, getDepth, getValue) {
  const result = [];
  for (let i = 0; i < headings.length; i += 1) {
    const heading = headings[i];
    result.push({
      depth: getDepth(heading),
      value: getValue(heading),
      id: heading.id || randomId(),
      getNode: () => heading.id ? document.getElementById(heading.id) : heading
    });
  }
  return result;
}
function getActiveElement(rects) {
  if (rects.length === 0) {
    return -1;
  }
  const closest = rects.reduce(
    (acc, item, index) => {
      if (Math.abs(acc.position) < Math.abs(item.y)) {
        return acc;
      }
      return {
        index,
        position: item.y
      };
    },
    { index: 0, position: rects[0].y }
  );
  return closest.index;
}
function getDefaultDepth(element) {
  return Number(element.tagName[1]);
}
function getDefaultValue(element) {
  return element.textContent || "";
}
function useScrollSpy({
  selector = "h1, h2, h3, h4, h5, h6",
  getDepth = getDefaultDepth,
  getValue = getDefaultValue
} = {}) {
  const [active, setActive] = useState(-1);
  const [initialized, setInitialized] = useState(false);
  const [data, setData] = useState([]);
  const headingsRef = useRef([]);
  const handleScroll = () => {
    setActive(
      getActiveElement(headingsRef.current.map((d) => d.getNode().getBoundingClientRect()))
    );
  };
  const initialize = () => {
    const headings = getHeadingsData(
      Array.from(document.querySelectorAll(selector)),
      getDepth,
      getValue
    );
    headingsRef.current = headings;
    setInitialized(true);
    setData(headings);
    setActive(getActiveElement(headings.map((d) => d.getNode().getBoundingClientRect())));
  };
  useEffect(() => {
    initialize();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  return {
    reinitialize: initialize,
    active,
    initialized,
    data
  };
}

export { useScrollSpy };
//# sourceMappingURL=use-scroll-spy.mjs.map
