'use client';
import { jsx } from 'react/jsx-runtime';
import 'react';
import { getSize } from '../../../core/utils/get-size/get-size.mjs';
import '@mantine/hooks';
import { createVarsResolver } from '../../../core/styles-api/create-vars-resolver/create-vars-resolver.mjs';
import 'clsx';
import { getThemeColor } from '../../../core/MantineProvider/color-functions/get-theme-color/get-theme-color.mjs';
import '../../../core/MantineProvider/Mantine.context.mjs';
import '../../../core/MantineProvider/default-theme.mjs';
import '../../../core/MantineProvider/MantineProvider.mjs';
import '../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../../core/MantineProvider/use-props/use-props.mjs';
import '../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { useStyles } from '../../../core/styles-api/use-styles/use-styles.mjs';
import { Box } from '../../../core/Box/Box.mjs';
import { factory } from '../../../core/factory/factory.mjs';
import '../../../core/DirectionProvider/DirectionProvider.mjs';
import classes from '../Combobox.module.css.mjs';

const defaultProps = {
  error: null
};
const varsResolver = createVarsResolver((theme, { size, color }) => ({
  chevron: {
    "--combobox-chevron-size": getSize(size, "combobox-chevron-size"),
    "--combobox-chevron-color": color ? getThemeColor(color, theme) : void 0
  }
}));
const ComboboxChevron = factory((_props, ref) => {
  const props = useProps("ComboboxChevron", defaultProps, _props);
  const { size, error, style, className, classNames, styles, unstyled, vars, mod, ...others } = props;
  const getStyles = useStyles({
    name: "ComboboxChevron",
    classes,
    props,
    style,
    className,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver,
    rootSelector: "chevron"
  });
  return /* @__PURE__ */ jsx(
    Box,
    {
      component: "svg",
      ...others,
      ...getStyles("chevron"),
      size,
      viewBox: "0 0 15 15",
      fill: "none",
      xmlns: "http://www.w3.org/2000/svg",
      mod: ["combobox-chevron", { error }, mod],
      ref,
      children: /* @__PURE__ */ jsx(
        "path",
        {
          d: "M4.93179 5.43179C4.75605 5.60753 4.75605 5.89245 4.93179 6.06819C5.10753 6.24392 5.39245 6.24392 5.56819 6.06819L7.49999 4.13638L9.43179 6.06819C9.60753 6.24392 9.89245 6.24392 10.0682 6.06819C10.2439 5.89245 10.2439 5.60753 10.0682 5.43179L7.81819 3.18179C7.73379 3.0974 7.61933 3.04999 7.49999 3.04999C7.38064 3.04999 7.26618 3.0974 7.18179 3.18179L4.93179 5.43179ZM10.0682 9.56819C10.2439 9.39245 10.2439 9.10753 10.0682 8.93179C9.89245 8.75606 9.60753 8.75606 9.43179 8.93179L7.49999 10.8636L5.56819 8.93179C5.39245 8.75606 5.10753 8.75606 4.93179 8.93179C4.75605 9.10753 4.75605 9.39245 4.93179 9.56819L7.18179 11.8182C7.35753 11.9939 7.64245 11.9939 7.81819 11.8182L10.0682 9.56819Z",
          fill: "currentColor",
          fillRule: "evenodd",
          clipRule: "evenodd"
        }
      )
    }
  );
});
ComboboxChevron.classes = classes;
ComboboxChevron.displayName = "@mantine/core/ComboboxChevron";

export { ComboboxChevron };
//# sourceMappingURL=ComboboxChevron.mjs.map
