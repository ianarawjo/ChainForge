'use client';
import cx from 'clsx';

const FOCUS_CLASS_NAMES = {
  always: "mantine-focus-always",
  auto: "mantine-focus-auto",
  never: "mantine-focus-never"
};
function getGlobalClassNames({ theme, options, unstyled }) {
  return cx(
    options?.focusable && !unstyled && (theme.focusClassName || FOCUS_CLASS_NAMES[theme.focusRing]),
    options?.active && !unstyled && theme.activeClassName
  );
}

export { FOCUS_CLASS_NAMES, getGlobalClassNames };
//# sourceMappingURL=get-global-class-names.mjs.map
