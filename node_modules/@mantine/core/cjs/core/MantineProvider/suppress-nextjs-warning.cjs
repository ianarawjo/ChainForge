'use client';
'use strict';

function suppressNextjsWarning() {
  const originalError = console.error;
  console.error = (...args) => {
    if (args.length > 1 && typeof args[0] === "string" && args[0].toLowerCase().includes("extra attributes from the server") && typeof args[1] === "string" && args[1].toLowerCase().includes("data-mantine-color-scheme")) ; else {
      originalError(...args);
    }
  };
}

exports.suppressNextjsWarning = suppressNextjsWarning;
//# sourceMappingURL=suppress-nextjs-warning.cjs.map
