'use client';
function getVariantClassName({
  options,
  classes,
  selector,
  unstyled
}) {
  return options?.variant && !unstyled ? classes[`${selector}--${options.variant}`] : void 0;
}

export { getVariantClassName };
//# sourceMappingURL=get-variant-class-name.mjs.map
