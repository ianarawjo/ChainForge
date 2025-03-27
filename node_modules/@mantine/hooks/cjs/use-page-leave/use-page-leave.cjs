'use client';
'use strict';

var React = require('react');

function usePageLeave(onPageLeave) {
  React.useEffect(() => {
    document.documentElement.addEventListener("mouseleave", onPageLeave);
    return () => document.documentElement.removeEventListener("mouseleave", onPageLeave);
  }, []);
}

exports.usePageLeave = usePageLeave;
//# sourceMappingURL=use-page-leave.cjs.map
