'use client';
'use strict';

function getVariantClassName({
  options,
  classes,
  selector,
  unstyled
}) {
  return options?.variant && !unstyled ? classes[`${selector}--${options.variant}`] : void 0;
}

exports.getVariantClassName = getVariantClassName;
//# sourceMappingURL=get-variant-class-name.cjs.map
