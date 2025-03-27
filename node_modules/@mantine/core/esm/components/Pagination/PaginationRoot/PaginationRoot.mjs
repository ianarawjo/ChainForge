'use client';
import { jsx } from 'react/jsx-runtime';
import { usePagination } from '@mantine/hooks';
import 'react';
import { getRadius, getSize, getFontSize } from '../../../core/utils/get-size/get-size.mjs';
import { createEventHandler } from '../../../core/utils/create-event-handler/create-event-handler.mjs';
import { createVarsResolver } from '../../../core/styles-api/create-vars-resolver/create-vars-resolver.mjs';
import 'clsx';
import { getThemeColor } from '../../../core/MantineProvider/color-functions/get-theme-color/get-theme-color.mjs';
import { getContrastColor } from '../../../core/MantineProvider/color-functions/get-contrast-color/get-contrast-color.mjs';
import { getAutoContrastValue } from '../../../core/MantineProvider/color-functions/get-auto-contrast-value/get-auto-contrast-value.mjs';
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
import { PaginationProvider } from '../Pagination.context.mjs';
import classes from '../Pagination.module.css.mjs';

const defaultProps = {
  siblings: 1,
  boundaries: 1
};
const varsResolver = createVarsResolver(
  (theme, { size, radius, color, autoContrast }) => ({
    root: {
      "--pagination-control-radius": radius === void 0 ? void 0 : getRadius(radius),
      "--pagination-control-size": getSize(size, "pagination-control-size"),
      "--pagination-control-fz": getFontSize(size),
      "--pagination-active-bg": color ? getThemeColor(color, theme) : void 0,
      "--pagination-active-color": getAutoContrastValue(autoContrast, theme) ? getContrastColor({ color, theme, autoContrast }) : void 0
    }
  })
);
const PaginationRoot = factory((_props, ref) => {
  const props = useProps("PaginationRoot", defaultProps, _props);
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
  const getStyles = useStyles({
    name: "Pagination",
    classes,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  const { range, setPage, next, previous, active, first, last } = usePagination({
    page: value,
    initialPage: defaultValue,
    onChange,
    total,
    siblings,
    boundaries
  });
  const handleNextPage = createEventHandler(onNextPage, next);
  const handlePreviousPage = createEventHandler(onPreviousPage, previous);
  const handleFirstPage = createEventHandler(onFirstPage, first);
  const handleLastPage = createEventHandler(onLastPage, last);
  return /* @__PURE__ */ jsx(
    PaginationProvider,
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
      children: /* @__PURE__ */ jsx(Box, { ref, ...getStyles("root"), ...others })
    }
  );
});
PaginationRoot.classes = classes;
PaginationRoot.displayName = "@mantine/core/PaginationRoot";

export { PaginationRoot };
//# sourceMappingURL=PaginationRoot.mjs.map
