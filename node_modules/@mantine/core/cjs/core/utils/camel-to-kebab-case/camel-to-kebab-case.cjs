'use client';
'use strict';

function camelToKebabCase(value) {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

exports.camelToKebabCase = camelToKebabCase;
//# sourceMappingURL=camel-to-kebab-case.cjs.map
