'use client';
function hashCode(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash;
}
const defaultColors = [
  "blue",
  "cyan",
  "grape",
  "green",
  "indigo",
  "lime",
  "orange",
  "pink",
  "red",
  "teal",
  "violet"
];
function getInitialsColor(name, colors = defaultColors) {
  const hash = hashCode(name);
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

export { getInitialsColor };
//# sourceMappingURL=get-initials-color.mjs.map
