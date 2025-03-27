'use client';
'use strict';

var cssObjectToString = require('../css-object-to-string/css-object-to-string.cjs');

function stylesToString({ selector, styles, media, container }) {
  const baseStyles = styles ? cssObjectToString.cssObjectToString(styles) : "";
  const mediaQueryStyles = !Array.isArray(media) ? [] : media.map((item) => `@media${item.query}{${selector}{${cssObjectToString.cssObjectToString(item.styles)}}}`);
  const containerStyles = !Array.isArray(container) ? [] : container.map(
    (item) => `@container ${item.query}{${selector}{${cssObjectToString.cssObjectToString(item.styles)}}}`
  );
  return `${baseStyles ? `${selector}{${baseStyles}}` : ""}${mediaQueryStyles.join("")}${containerStyles.join("")}`.trim();
}

exports.stylesToString = stylesToString;
//# sourceMappingURL=styles-to-string.cjs.map
