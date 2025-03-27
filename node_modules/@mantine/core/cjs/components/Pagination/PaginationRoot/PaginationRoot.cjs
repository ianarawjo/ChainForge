'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var hooks = require('@mantine/hooks');
require('react');
var getSize = require('../../../core/utils/get-size/get-size.cjs');
var createEventHandler = require('../../../core/utils/create-event-handler/create-event-handler.cjs');
var createVarsResolver = require('../../../core/styles-api/create-vars-resolver/create-vars-resolver.cjs');
require('clsx');
var getThemeColor = require('../../../core/MantineProvider/color-functions/get-theme-color/get-theme-color.cjs');
var getContrastColor = require('../../../core/MantineProvider/color-functions/get-contrast-color/get-contrast-color.cjs');
var getAutoContrastValue = require('../../../core/MantineProvider/color-functions/get-auto-contrast-value/get-auto-contrast-value.cjs');
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
var Pagination_context = require('../Pagination.context.cjs');
var Pagination_module = require('../Pagination.module.css.cjs');

const defaultProps = {
  siblings: 1,
  boundaries: 1
};
const varsResolver = createVarsResolver.createVarsResolver(
  (theme, { size, radius, color, autoContrast }) => ({
    root: {
      "--pagination-control-radius": radius === void 0 ? void 0 : getSize.getRadius(radius),
      "--pagination-control-size": getSize.getSize(size, "pagination-control-size"),
      "--pagination-control-fz": getSize.getFontSize(size),
      "--pagination-active-bg": color ? getThemeColor.getThemeColor(color, theme) : void 0,
      "--pagination-active-color": getAutoContrastValue.getAutoContrastValue(autoContrast, theme) ? getContrastColor.getContrastColor({ color, theme, autoContrast }) : void 0
    }
  })
);
const PaginationRoot = factory.factory((_props, ref) => {
  const props = useProps.useProps("PaginationRoot", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    total,
    value,
    defaultValue,
    onChange,
    disabled,
    siblings,
    boundaries,
    color,
    radius,
    onNextPage,
    onPreviousPage,
    onFirstPage,
    onLastPage,
    getItemProps,
    autoContrast,
    ...others
  } = props;
  const getStyles = useStyles.useStyles({
    name: "Pagination",
    classes: Pagination_module,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  const { range, setPage, next, previous, active, first, last } = hooks.usePagination({
    page: value,
    initialPage: defaultValue,
    onChange,
    total,
    siblings,
    boundaries
  });
  const handleNextPage = createEventHandler.createEventHandler(onNextPage, next);
  const handlePreviousPage = createEventHandler.createEventHandler(onPreviousPage, previous);
  const handleFirstPage = createEventHandler.createEventHandler(onFirstPage, first);
  const handleLastPage = createEventHandler.createEventHandler(onLastPage, last);
  return /* @__PURE__ */ jsxRuntime.jsx(
    Pagination_context.PaginationProvider,
    {
      value: {
        total,
        range,
        active,
        disabled,
        getItemProps,
        onChange: setPage,
        onNext: handleNextPage,
        onPrevious: handlePreviousPage,
        onFirst: handleFirstPage,
        onLast: handleLastPage,
        getStyles
      },
      children: /* @__PURE__ */ jsxRuntime.jsx(Box.Box, { ref, ...getStyles("root"), ...others })
    }
  );
});
PaginationRoot.classes = Pagination_module;
PaginationRoot.displayName = "@mantine/core/PaginationRoot";

exports.PaginationRoot = PaginationRoot;
//# sourceMappingURL=PaginationRoot.cjs.map
