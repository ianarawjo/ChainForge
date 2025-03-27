'use client';
import { jsx } from 'react/jsx-runtime';
import 'react';
import { getSize } from '../../../core/utils/get-size/get-size.mjs';
import '@mantine/hooks';
import { createVarsResolver } from '../../../core/styles-api/create-vars-resolver/create-vars-resolver.mjs';
import 'clsx';
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
import { usePillsInputContext } from '../../PillsInput/PillsInput.context.mjs';
import { PillGroupProvider } from '../PillGroup.context.mjs';
import classes from '../Pill.module.css.mjs';

const defaultProps = {};
const varsResolver = createVarsResolver((_, { gap }, { size }) => ({
  group: {
    "--pg-gap": gap !== void 0 ? getSize(gap) : getSize(size, "pg-gap")
  }
}));
const PillGroup = factory((_props, ref) => {
  const props = useProps("PillGroup", defaultProps, _props);
  const { classNames, className, style, styles, unstyled, vars, size, disabled, ...others } = props;
  const pillsInputCtx = usePillsInputContext();
  const _size = pillsInputCtx?.size || size || void 0;
  const getStyles = useStyles({
    name: "PillGroup",
    classes,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver,
    stylesCtx: { size: _size },
    rootSelector: "group"
  });
  return /* @__PURE__ */ jsx(PillGroupProvider, { value: { size: _size, disabled }, children: /* @__PURE__ */ jsx(Box, { ref, size: _size, ...getStyles("group"), ...others }) });
});
PillGroup.classes = classes;
PillGroup.displayName = "@mantine/core/PillGroup";

export { PillGroup };
//# sourceMappingURL=PillGroup.mjs.map
