'use client';
'use strict';

var borderResolver = require('./border-resolver/border-resolver.cjs');
var colorResolver = require('./color-resolver/color-resolver.cjs');
var fontFamilyResolver = require('./font-family-resolver/font-family-resolver.cjs');
var fontSizeResolver = require('./font-size-resolver/font-size-resolver.cjs');
var identityResolver = require('./identity-resolver/identity-resolver.cjs');
var lineHeightResolver = require('./line-height-resolver/line-height-resolver.cjs');
var sizeResolver = require('./size-resolver/size-resolver.cjs');
var spacingResolver = require('./spacing-resolver/spacing-resolver.cjs');

const resolvers = {
  color: colorResolver.colorResolver,
  textColor: colorResolver.textColorResolver,
  fontSize: fontSizeResolver.fontSizeResolver,
  spacing: spacingResolver.spacingResolver,
  identity: identityResolver.identityResolver,
  size: sizeResolver.sizeResolver,
  lineHeight: lineHeightResolver.lineHeightResolver,
  fontFamily: fontFamilyResolver.fontFamilyResolver,
  border: borderResolver.borderResolver
};

exports.resolvers = resolvers;
//# sourceMappingURL=index.cjs.map
