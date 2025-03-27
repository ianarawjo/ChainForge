'use client';
import { borderResolver } from './border-resolver/border-resolver.mjs';
import { colorResolver, textColorResolver } from './color-resolver/color-resolver.mjs';
import { fontFamilyResolver } from './font-family-resolver/font-family-resolver.mjs';
import { fontSizeResolver } from './font-size-resolver/font-size-resolver.mjs';
import { identityResolver } from './identity-resolver/identity-resolver.mjs';
import { lineHeightResolver } from './line-height-resolver/line-height-resolver.mjs';
import { sizeResolver } from './size-resolver/size-resolver.mjs';
import { spacingResolver } from './spacing-resolver/spacing-resolver.mjs';

const resolvers = {
  color: colorResolver,
  textColor: textColorResolver,
  fontSize: fontSizeResolver,
  spacing: spacingResolver,
  identity: identityResolver,
  size: sizeResolver,
  lineHeight: lineHeightResolver,
  fontFamily: fontFamilyResolver,
  border: borderResolver
};

export { resolvers };
//# sourceMappingURL=index.mjs.map
