'use client';
function getClientPosition(event) {
  if ("TouchEvent" in window && event instanceof window.TouchEvent) {
    const touch = event.touches[0];
    return touch.clientX;
  }
  return event.clientX;
}

export { getClientPosition };
//# sourceMappingURL=get-client-position.mjs.map
