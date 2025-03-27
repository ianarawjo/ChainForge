'use client';
function randomId(prefix = "mantine-") {
  return `${prefix}${Math.random().toString(36).slice(2, 11)}`;
}

export { randomId };
//# sourceMappingURL=random-id.mjs.map
