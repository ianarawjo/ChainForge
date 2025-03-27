'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
require('react');
require('@mantine/hooks');
require('clsx');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../core/MantineProvider/use-props/use-props.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
require('../../core/Box/Box.cjs');
var factory = require('../../core/factory/factory.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
var Group = require('../Group/Group.cjs');
var PaginationControl = require('./PaginationControl/PaginationControl.cjs');
var PaginationDots = require('./PaginationDots/PaginationDots.cjs');
var PaginationEdges = require('./PaginationEdges/PaginationEdges.cjs');
var PaginationItems = require('./PaginationItems/PaginationItems.cjs');
var PaginationRoot = require('./PaginationRoot/PaginationRoot.cjs');
var Pagination_module = require('./Pagination.module.css.cjs');

const defaultProps = {
  withControls: true,
  withPages: true,
  siblings: 1,
  boundaries: 1,
  gap: 8
};
const Pagination = factory.factory((_props, ref) => {
  const props = useProps.useProps("Pagination", defaultProps, _props);
  const {
    withEdges,
    withControls,
    getControlProps,
    nextIcon,
    previousIcon,
    lastIcon,
    firstIcon,
    dotsIcon,
    total,
    gap,
    hideWithOnePage,
    withPages,
    ...others
  } = props;
  if (total <= 0 || hideWithOnePage && total === 1) {
    return null;
  }
  return /* @__PURE__ */ jsxRuntime.jsx(PaginationRoot.PaginationRoot, { ref, total, ...others, children: /* @__PURE__ */ jsxRuntime.jsxs(Group.Group, { gap, children: [
    withEdges && /* @__PURE__ */ jsxRuntime.jsx(PaginationEdges.PaginationFirst, { icon: firstIcon, ...getControlProps?.("first") }),
    withControls && /* @__PURE__ */ jsxRuntime.jsx(PaginationEdges.PaginationPrevious, { icon: previousIcon, ...getControlProps?.("previous") }),
    withPages && /* @__PURE__ */ jsxRuntime.jsx(PaginationItems.PaginationItems, { dotsIcon }),
    withControls && /* @__PURE__ */ jsxRuntime.jsx(PaginationEdges.PaginationNext, { icon: nextIcon, ...getControlProps?.("next") }),
    withEdges && /* @__PURE__ */ jsxRuntime.jsx(PaginationEdges.PaginationLast, { icon: lastIcon, ...getControlProps?.("last") })
  ] }) });
});
Pagination.classes = Pagination_module;
Pagination.displayName = "@mantine/core/Pagination";
Pagination.Root = PaginationRoot.PaginationRoot;
Pagination.Control = PaginationControl.PaginationControl;
Pagination.Dots = PaginationDots.PaginationDots;
Pagination.First = PaginationEdges.PaginationFirst;
Pagination.Last = PaginationEdges.PaginationLast;
Pagination.Next = PaginationEdges.PaginationNext;
Pagination.Previous = PaginationEdges.PaginationPrevious;
Pagination.Items = PaginationItems.PaginationItems;

exports.Pagination = Pagination;
//# sourceMappingURL=Pagination.cjs.map
