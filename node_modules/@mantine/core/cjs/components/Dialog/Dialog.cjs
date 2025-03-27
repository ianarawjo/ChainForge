'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
require('react');
var getSize = require('../../core/utils/get-size/get-size.cjs');
require('@mantine/hooks');
var createVarsResolver = require('../../core/styles-api/create-vars-resolver/create-vars-resolver.cjs');
require('clsx');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../core/MantineProvider/use-props/use-props.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var useStyles = require('../../core/styles-api/use-styles/use-styles.cjs');
require('../../core/Box/Box.cjs');
var factory = require('../../core/factory/factory.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
var Affix = require('../Affix/Affix.cjs');
require('../CloseButton/CloseIcon.cjs');
var CloseButton = require('../CloseButton/CloseButton.cjs');
var Paper = require('../Paper/Paper.cjs');
var Transition = require('../Transition/Transition.cjs');
var Dialog_module = require('./Dialog.module.css.cjs');

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
const varsResolver = createVarsResolver.createVarsResolver((_, { size }) => ({
  root: {
    "--dialog-size": getSize.getSize(size, "dialog-size")
  }
}));
const Dialog = factory.factory((_props, ref) => {
  const props = useProps.useProps("Dialog", defaultProps, _props);
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
  const getStyles = useStyles.useStyles({
    name: "Dialog",
    classes: Dialog_module,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  return /* @__PURE__ */ jsxRuntime.jsx(
    Affix.Affix,
    {
      zIndex,
      position,
      ref,
      withinPortal,
      portalProps,
      unstyled,
      children: /* @__PURE__ */ jsxRuntime.jsx(Transition.Transition, { keepMounted, mounted: opened, ...transitionProps, children: (transitionStyles) => /* @__PURE__ */ jsxRuntime.jsxs(
        Paper.Paper,
        {
          unstyled,
          ...getStyles("root", { style: transitionStyles }),
          ...others,
          children: [
            withCloseButton && /* @__PURE__ */ jsxRuntime.jsx(CloseButton.CloseButton, { onClick: onClose, unstyled, ...getStyles("closeButton") }),
            children
          ]
        }
      ) })
    }
  );
});
Dialog.classes = Dialog_module;
Dialog.displayName = "@mantine/core/Dialog";

exports.Dialog = Dialog;
//# sourceMappingURL=Dialog.cjs.map
