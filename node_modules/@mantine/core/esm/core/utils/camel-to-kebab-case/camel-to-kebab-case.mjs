'use client';
function camelToKebabCase(value) {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

export { camelToKebabCase };
//# sourceMappingURL=camel-to-kebab-case.mjs.map
