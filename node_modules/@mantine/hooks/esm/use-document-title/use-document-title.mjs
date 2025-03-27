'use client';
import { useIsomorphicEffect } from '../use-isomorphic-effect/use-isomorphic-effect.mjs';

function useDocumentTitle(title) {
  useIsomorphicEffect(() => {
    if (typeof title === "string" && title.trim().length > 0) {
      document.title = title.trim();
    }
  }, [title]);
}

export { useDocumentTitle };
//# sourceMappingURL=use-document-title.mjs.map
