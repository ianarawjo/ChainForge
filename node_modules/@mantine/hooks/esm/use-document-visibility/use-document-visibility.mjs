'use client';
import { useState, useEffect } from 'react';

function useDocumentVisibility() {
  const [documentVisibility, setDocumentVisibility] = useState("visible");
  useEffect(() => {
    const listener = () => setDocumentVisibility(document.visibilityState);
    document.addEventListener("visibilitychange", listener);
    return () => document.removeEventListener("visibilitychange", listener);
  }, []);
  return documentVisibility;
}

export { useDocumentVisibility };
//# sourceMappingURL=use-document-visibility.mjs.map
