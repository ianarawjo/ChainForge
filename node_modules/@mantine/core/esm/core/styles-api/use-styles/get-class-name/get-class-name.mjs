'use client';
import cx from 'clsx';
import { getGlobalClassNames } from './get-global-class-names/get-global-class-names.mjs';
import { getOptionsClassNames } from './get-options-class-names/get-options-class-names.mjs';
import { getResolvedClassNames } from './get-resolved-class-names/get-resolved-class-names.mjs';
import { getRootClassName } from './get-root-class-name/get-root-class-name.mjs';
import { getSelectorClassName } from './get-selector-class-name/get-selector-class-name.mjs';
import { getStaticClassNames } from './get-static-class-names/get-static-class-names.mjs';
import { getThemeClassNames } from './get-theme-class-names/get-theme-class-names.mjs';
import { getVariantClassName } from './get-variant-class-name/get-variant-class-name.mjs';

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
  return cx(
    getGlobalClassNames({ theme, options, unstyled: unstyled || headless }),
    getThemeClassNames({ theme, themeName, selector, props, stylesCtx }),
    getVariantClassName({ options, classes, selector, unstyled }),
    getResolvedClassNames({ selector, stylesCtx, theme, classNames, props }),
    getResolvedClassNames({ selector, stylesCtx, theme, classNames: transformedStyles, props }),
    getOptionsClassNames({ selector, stylesCtx, options, props, theme }),
    getRootClassName({ rootSelector, selector, className }),
    getSelectorClassName({ selector, classes, unstyled: unstyled || headless }),
    withStaticClasses && !headless && getStaticClassNames({
      themeName,
      classNamesPrefix,
      selector,
      withStaticClass: options?.withStaticClass
    }),
    options?.className
  );
}

export { getClassName };
//# sourceMappingURL=get-class-name.mjs.map
