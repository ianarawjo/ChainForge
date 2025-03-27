'use client';
'use strict';

var React = require('react');

function useDocumentVisibility() {
  const [documentVisibility, setDocumentVisibility] = React.useState("visible");
  React.useEffect(() => {
    const listener = () => setDocumentVisibility(document.visibilityState);
    document.addEventListener("visibilitychange", listener);
    return () => document.removeEventListener("visibilitychange", listener);
  }, []);
  return documentVisibility;
}

exports.useDocumentVisibility = useDocumentVisibility;
//# sourceMappingURL=use-document-visibility.cjs.map
