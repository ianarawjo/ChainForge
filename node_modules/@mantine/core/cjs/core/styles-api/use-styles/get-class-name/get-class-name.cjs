'use client';
'use strict';

var cx = require('clsx');
var getGlobalClassNames = require('./get-global-class-names/get-global-class-names.cjs');
var getOptionsClassNames = require('./get-options-class-names/get-options-class-names.cjs');
var getResolvedClassNames = require('./get-resolved-class-names/get-resolved-class-names.cjs');
var getRootClassName = require('./get-root-class-name/get-root-class-name.cjs');
var getSelectorClassName = require('./get-selector-class-name/get-selector-class-name.cjs');
var getStaticClassNames = require('./get-static-class-names/get-static-class-names.cjs');
var getThemeClassNames = require('./get-theme-class-names/get-theme-class-names.cjs');
var getVariantClassName = require('./get-variant-class-name/get-variant-class-name.cjs');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var cx__default = /*#__PURE__*/_interopDefault(cx);

function getClassName({
  theme,
  options,
  themeName,
  selector,
  classNamesPrefix,
  classNames,
  classes,
  unstyled,
  className,
  rootSelector,
  props,
  stylesCtx,
  withStaticClasses,
  headless,
  transformedStyles
}) {
  return cx__default.default(
    getGlobalClassNames.getGlobalClassNames({ theme, options, unstyled: unstyled || headless }),
    getThemeClassNames.getThemeClassNames({ theme, themeName, selector, props, stylesCtx }),
    getVariantClassName.getVariantClassName({ options, classes, selector, unstyled }),
    getResolvedClassNames.getResolvedClassNames({ selector, stylesCtx, theme, classNames, props }),
    getResolvedClassNames.getResolvedClassNames({ selector, stylesCtx, theme, classNames: transformedStyles, props }),
    getOptionsClassNames.getOptionsClassNames({ selector, stylesCtx, options, props, theme }),
    getRootClassName.getRootClassName({ rootSelector, selector, className }),
    getSelectorClassName.getSelectorClassName({ selector, classes, unstyled: unstyled || headless }),
    withStaticClasses && !headless && getStaticClassNames.getStaticClassNames({
      themeName,
      classNamesPrefix,
      selector,
      withStaticClass: options?.withStaticClass
    }),
    options?.className
  );
}

exports.getClassName = getClassName;
//# sourceMappingURL=get-class-name.cjs.map
