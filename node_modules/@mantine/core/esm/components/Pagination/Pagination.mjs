'use client';
import { jsx, jsxs } from 'react/jsx-runtime';
import 'react';
import '@mantine/hooks';
import 'clsx';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../core/MantineProvider/use-props/use-props.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import '../../core/Box/Box.mjs';
import { factory } from '../../core/factory/factory.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import { Group } from '../Group/Group.mjs';
import { PaginationControl } from './PaginationControl/PaginationControl.mjs';
import { PaginationDots } from './PaginationDots/PaginationDots.mjs';
import { PaginationFirst, PaginationLast, PaginationNext, PaginationPrevious } from './PaginationEdges/PaginationEdges.mjs';
import { PaginationItems } from './PaginationItems/PaginationItems.mjs';
import { PaginationRoot } from './PaginationRoot/PaginationRoot.mjs';
import classes from './Pagination.module.css.mjs';

const defaultProps = {
  withControls: true,
  withPages: true,
  siblings: 1,
  boundaries: 1,
  gap: 8
};
const Pagination = factory((_props, ref) => {
  const props = useProps("Pagination", defaultProps, _props);
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
  return /* @__PURE__ */ jsx(PaginationRoot, { ref, total, ...others, children: /* @__PURE__ */ jsxs(Group, { gap, children: [
    withEdges && /* @__PURE__ */ jsx(PaginationFirst, { icon: firstIcon, ...getControlProps?.("first") }),
    withControls && /* @__PURE__ */ jsx(PaginationPrevious, { icon: previousIcon, ...getControlProps?.("previous") }),
    withPages && /* @__PURE__ */ jsx(PaginationItems, { dotsIcon }),
    withControls && /* @__PURE__ */ jsx(PaginationNext, { icon: nextIcon, ...getControlProps?.("next") }),
    withEdges && /* @__PURE__ */ jsx(PaginationLast, { icon: lastIcon, ...getControlProps?.("last") })
  ] }) });
});
Pagination.classes = classes;
Pagination.displayName = "@mantine/core/Pagination";
Pagination.Root = PaginationRoot;
Pagination.Control = PaginationControl;
Pagination.Dots = PaginationDots;
Pagination.First = PaginationFirst;
Pagination.Last = PaginationLast;
Pagination.Next = PaginationNext;
Pagination.Previous = PaginationPrevious;
Pagination.Items = PaginationItems;

export { Pagination };
//# sourceMappingURL=Pagination.mjs.map
