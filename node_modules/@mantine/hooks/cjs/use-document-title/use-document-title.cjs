'use client';
'use strict';

var useIsomorphicEffect = require('../use-isomorphic-effect/use-isomorphic-effect.cjs');

function useDocumentTitle(title) {
  useIsomorphicEffect.useIsomorphicEffect(() => {
    if (typeof title === "string" && title.trim().length > 0) {
      document.title = title.trim();
    }
  }, [title]);
}

exports.useDocumentTitle = useDocumentTitle;
//# sourceMappingURL=use-document-title.cjs.map
