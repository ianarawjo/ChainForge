'use client';
import { jsx, jsxs } from 'react/jsx-runtime';
import 'react';
import { getSize } from '../../core/utils/get-size/get-size.mjs';
import '@mantine/hooks';
import { createVarsResolver } from '../../core/styles-api/create-vars-resolver/create-vars-resolver.mjs';
import 'clsx';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../core/MantineProvider/use-props/use-props.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { useStyles } from '../../core/styles-api/use-styles/use-styles.mjs';
import '../../core/Box/Box.mjs';
import { factory } from '../../core/factory/factory.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import { Affix } from '../Affix/Affix.mjs';
import '../CloseButton/CloseIcon.mjs';
import { CloseButton } from '../CloseButton/CloseButton.mjs';
import { Paper } from '../Paper/Paper.mjs';
import { Transition } from '../Transition/Transition.mjs';
import classes from './Dialog.module.css.mjs';

const defaultProps = {
  shadow: "md",
  p: "md",
  withBorder: false,
  transitionProps: { transition: "pop-top-right", duration: 200 },
  position: {
    bottom: 30,
    right: 30
  }
};
const varsResolver = createVarsResolver((_, { size }) => ({
  root: {
    "--dialog-size": getSize(size, "dialog-size")
  }
}));
const Dialog = factory((_props, ref) => {
  const props = useProps("Dialog", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    zIndex,
    position,
    keepMounted,
    opened,
    transitionProps,
    withCloseButton,
    withinPortal,
    children,
    onClose,
    portalProps,
    ...others
  } = props;
  const getStyles = useStyles({
    name: "Dialog",
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
  return /* @__PURE__ */ jsx(
    Affix,
    {
      zIndex,
      position,
      ref,
      withinPortal,
      portalProps,
      unstyled,
      children: /* @__PURE__ */ jsx(Transition, { keepMounted, mounted: opened, ...transitionProps, children: (transitionStyles) => /* @__PURE__ */ jsxs(
        Paper,
        {
          unstyled,
          ...getStyles("root", { style: transitionStyles }),
          ...others,
          children: [
            withCloseButton && /* @__PURE__ */ jsx(CloseButton, { onClick: onClose, unstyled, ...getStyles("closeButton") }),
            children
          ]
        }
      ) })
    }
  );
});
Dialog.classes = classes;
Dialog.displayName = "@mantine/core/Dialog";

export { Dialog };
//# sourceMappingURL=Dialog.mjs.map
