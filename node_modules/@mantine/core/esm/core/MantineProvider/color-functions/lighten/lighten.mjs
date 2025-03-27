import { toRgba } from '../to-rgba/to-rgba.mjs';

function lighten(color, alpha) {
  if (color.startsWith("var(")) {
    return `color-mix(in srgb, ${color}, white ${alpha * 100}%)`;
  }
  const { r, g, b, a } = toRgba(color);
  const light = (input) => Math.round(input + (255 - input) * alpha);
  return `rgba(${light(r)}, ${light(g)}, ${light(b)}, ${a})`;
}

export { lighten };
//# sourceMappingURL=lighten.mjs.map
