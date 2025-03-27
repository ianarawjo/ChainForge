'use client';
'use strict';

function isScrollingWithinScrollbarBounds(scrollPos, maxScrollPos) {
  return scrollPos > 0 && scrollPos < maxScrollPos;
}

exports.isScrollingWithinScrollbarBounds = isScrollingWithinScrollbarBounds;
//# sourceMappingURL=is-scrolling-within-scrollbar-bounds.cjs.map
