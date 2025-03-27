'use client';
'use strict';

function wrapWithSelector(selectors, code) {
  const _selectors = Array.isArray(selectors) ? selectors : [selectors];
  return _selectors.reduce((acc, selector) => `${selector}{${acc}}`, code);
}

exports.wrapWithSelector = wrapWithSelector;
//# sourceMappingURL=wrap-with-selector.cjs.map
