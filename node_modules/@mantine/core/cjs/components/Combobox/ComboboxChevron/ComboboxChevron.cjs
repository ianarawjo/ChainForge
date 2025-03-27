'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
require('react');
var getSize = require('../../../core/utils/get-size/get-size.cjs');
require('@mantine/hooks');
var createVarsResolver = require('../../../core/styles-api/create-vars-resolver/create-vars-resolver.cjs');
require('clsx');
var getThemeColor = require('../../../core/MantineProvider/color-functions/get-theme-color/get-theme-color.cjs');
require('../../../core/MantineProvider/Mantine.context.cjs');
require('../../../core/MantineProvider/default-theme.cjs');
require('../../../core/MantineProvider/MantineProvider.cjs');
require('../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../../core/MantineProvider/use-props/use-props.cjs');
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var useStyles = require('../../../core/styles-api/use-styles/use-styles.cjs');
var Box = require('../../../core/Box/Box.cjs');
var factory = require('../../../core/factory/factory.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');
var Combobox_module = require('../Combobox.module.css.cjs');

const defaultProps = {
  error: null
};
const varsResolver = createVarsResolver.createVarsResolver((theme, { size, color }) => ({
  chevron: {
    "--combobox-chevron-size": getSize.getSize(size, "combobox-chevron-size"),
    "--combobox-chevron-color": color ? getThemeColor.getThemeColor(color, theme) : void 0
  }
}));
const ComboboxChevron = factory.factory((_props, ref) => {
  const props = useProps.useProps("ComboboxChevron", defaultProps, _props);
  const { size, error, style, className, classNames, styles, unstyled, vars, mod, ...others } = props;
  const getStyles = useStyles.useStyles({
    name: "ComboboxChevron",
    classes: Combobox_module,
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
  return /* @__PURE__ */ jsxRuntime.jsx(
    Box.Box,
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
      children: /* @__PURE__ */ jsxRuntime.jsx(
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
ComboboxChevron.classes = Combobox_module;
ComboboxChevron.displayName = "@mantine/core/ComboboxChevron";

exports.ComboboxChevron = ComboboxChevron;
//# sourceMappingURL=ComboboxChevron.cjs.map
