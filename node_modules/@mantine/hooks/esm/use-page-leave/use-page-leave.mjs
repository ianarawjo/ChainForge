'use client';
import { useEffect } from 'react';

function usePageLeave(onPageLeave) {
  useEffect(() => {
    document.documentElement.addEventListener("mouseleave", onPageLeave);
    return () => document.documentElement.removeEventListener("mouseleave", onPageLeave);
  }, []);
}

export { usePageLeave };
//# sourceMappingURL=use-page-leave.mjs.map
