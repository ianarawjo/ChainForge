'use client';
'use strict';

var React = require('react');
var useIsomorphicEffect = require('../use-isomorphic-effect/use-isomorphic-effect.cjs');

const MIME_TYPES = {
  ico: "image/x-icon",
  png: "image/png",
  svg: "image/svg+xml",
  gif: "image/gif"
};
function useFavicon(url) {
  const link = React.useRef(null);
  useIsomorphicEffect.useIsomorphicEffect(() => {
    if (!url) {
      return;
    }
    if (!link.current) {
      const existingElements = document.querySelectorAll('link[rel*="icon"]');
      existingElements.forEach((element2) => document.head.removeChild(element2));
      const element = document.createElement("link");
      element.rel = "shortcut icon";
      link.current = element;
      document.querySelector("head").appendChild(element);
    }
    const splittedUrl = url.split(".");
    link.current.setAttribute(
      "type",
      MIME_TYPES[splittedUrl[splittedUrl.length - 1].toLowerCase()]
    );
    link.current.setAttribute("href", url);
  }, [url]);
}

exports.useFavicon = useFavicon;
//# sourceMappingURL=use-favicon.cjs.map
