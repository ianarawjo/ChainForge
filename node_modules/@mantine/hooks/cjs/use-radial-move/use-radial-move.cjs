'use client';
'use strict';

var React = require('react');
var clamp = require('../utils/clamp/clamp.cjs');

function radiansToDegrees(radians) {
  return radians * (180 / Math.PI);
}
function getElementCenter(element) {
  const rect = element.getBoundingClientRect();
  return [rect.left + rect.width / 2, rect.top + rect.height / 2];
}
function getAngle(coordinates, element) {
  const center = getElementCenter(element);
  const x = coordinates[0] - center[0];
  const y = coordinates[1] - center[1];
  const deg = radiansToDegrees(Math.atan2(x, y)) + 180;
  return 360 - deg;
}
function toFixed(value, digits) {
  return parseFloat(value.toFixed(digits));
}
function getDigitsAfterDot(value) {
  return value.toString().split(".")[1]?.length || 0;
}
function normalizeRadialValue(degree, step) {
  const clamped = clamp.clamp(degree, 0, 360);
  const high = Math.ceil(clamped / step);
  const low = Math.round(clamped / step);
  return toFixed(
    high >= clamped / step ? high * step === 360 ? 0 : high * step : low * step,
    getDigitsAfterDot(step)
  );
}
function useRadialMove(onChange, { step = 0.01, onChangeEnd, onScrubStart, onScrubEnd } = {}) {
  const ref = React.useRef(null);
  const mounted = React.useRef(false);
  const [active, setActive] = React.useState(false);
  React.useEffect(() => {
    mounted.current = true;
  }, []);
  React.useEffect(() => {
    const node = ref.current;
    const update = (event, done = false) => {
      if (node) {
        node.style.userSelect = "none";
        const deg = getAngle([event.clientX, event.clientY], node);
        const newValue = normalizeRadialValue(deg, step || 1);
        onChange(newValue);
        done && onChangeEnd?.(newValue);
      }
    };
    const beginTracking = () => {
      onScrubStart?.();
      setActive(true);
      document.addEventListener("mousemove", handleMouseMove, false);
      document.addEventListener("mouseup", handleMouseUp, false);
      document.addEventListener("touchmove", handleTouchMove, { passive: false });
      document.addEventListener("touchend", handleTouchEnd, false);
    };
    const endTracking = () => {
      onScrubEnd?.();
      setActive(false);
      document.removeEventListener("mousemove", handleMouseMove, false);
      document.removeEventListener("mouseup", handleMouseUp, false);
      document.removeEventListener("touchmove", handleTouchMove, false);
      document.removeEventListener("touchend", handleTouchEnd, false);
    };
    const onMouseDown = (event) => {
      beginTracking();
      update(event);
    };
    const handleMouseMove = (event) => {
      update(event);
    };
    const handleMouseUp = (event) => {
      update(event, true);
      endTracking();
    };
    const handleTouchMove = (event) => {
      event.preventDefault();
      update(event.touches[0]);
    };
    const handleTouchEnd = (event) => {
      update(event.changedTouches[0], true);
      endTracking();
    };
    const handleTouchStart = (event) => {
      event.preventDefault();
      beginTracking();
      update(event.touches[0]);
    };
    node?.addEventListener("mousedown", onMouseDown);
    node?.addEventListener("touchstart", handleTouchStart, { passive: false });
    return () => {
      if (node) {
        node.removeEventListener("mousedown", onMouseDown);
        node.removeEventListener("touchstart", handleTouchStart);
      }
    };
  }, [onChange]);
  return { ref, active };
}

exports.normalizeRadialValue = normalizeRadialValue;
exports.useRadialMove = useRadialMove;
//# sourceMappingURL=use-radial-move.cjs.map
