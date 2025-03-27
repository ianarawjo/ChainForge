'use client';
import { jsx } from 'react/jsx-runtime';
import 'react';
import '@mantine/hooks';
import 'clsx';
import { useResolvedStylesApi } from '../../core/styles-api/use-resolved-styles-api/use-resolved-styles-api.mjs';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../core/MantineProvider/use-props/use-props.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../core/Box/Box.mjs';
import { factory } from '../../core/factory/factory.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import { ProgressLabel } from './ProgressLabel/ProgressLabel.mjs';
import { ProgressRoot } from './ProgressRoot/ProgressRoot.mjs';
import { ProgressSection } from './ProgressSection/ProgressSection.mjs';
import classes from './Progress.module.css.mjs';

const defaultProps = {};
const Progress = factory((_props, ref) => {
  const props = useProps("Progress", defaultProps, _props);
  const {
    value,
    classNames,
    styles,
    vars,
    color,
    striped,
    animated,
    "aria-label": label,
    ...others
  } = props;
  const { resolvedClassNames, resolvedStyles } = useResolvedStylesApi({
    classNames,
    styles,
    props
  });
  return /* @__PURE__ */ jsx(
    ProgressRoot,
    {
      ref,
      classNames: resolvedClassNames,
      styles: resolvedStyles,
      vars,
      ...others,
      children: /* @__PURE__ */ jsx(
        ProgressSection,
        {
          value,
          color,
          striped,
          animated,
          "aria-label": label
        }
      )
    }
  );
});
Progress.classes = classes;
Progress.displayName = "@mantine/core/Progress";
Progress.Section = ProgressSection;
Progress.Root = ProgressRoot;
Progress.Label = ProgressLabel;

export { Progress };
//# sourceMappingURL=Progress.mjs.map
