'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var hooks = require('@mantine/hooks');
var rem = require('../../core/utils/units-converters/rem.cjs');
require('react');
var createVarsResolver = require('../../core/styles-api/create-vars-resolver/create-vars-resolver.cjs');
require('clsx');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../core/MantineProvider/use-props/use-props.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var useStyles = require('../../core/styles-api/use-styles/use-styles.cjs');
var Box = require('../../core/Box/Box.cjs');
var factory = require('../../core/factory/factory.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
var Anchor = require('../Anchor/Anchor.cjs');
var Spoiler_module = require('./Spoiler.module.css.cjs');

const defaultProps = {
  maxHeight: 100,
  initialState: false
};
const varsResolver = createVarsResolver.createVarsResolver((_, { transitionDuration }) => ({
  root: {
    "--spoiler-transition-duration": transitionDuration !== void 0 ? `${transitionDuration}ms` : void 0
  }
}));
const Spoiler = factory.factory((_props, ref) => {
  const props = useProps.useProps("Spoiler", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    initialState,
    maxHeight,
    hideLabel,
    showLabel,
    children,
    controlRef,
    transitionDuration,
    id,
    expanded,
    onExpandedChange,
    ...others
  } = props;
  const getStyles = useStyles.useStyles({
    name: "Spoiler",
    classes: Spoiler_module,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  const _id = hooks.useId(id);
  const regionId = `${_id}-region`;
  const [show, setShowState] = hooks.useUncontrolled({
    value: expanded,
    defaultValue: initialState,
    finalValue: false,
    onChange: onExpandedChange
  });
  const { ref: contentRef, height } = hooks.useElementSize();
  const spoilerMoreContent = show ? hideLabel : showLabel;
  const spoiler = spoilerMoreContent !== null && maxHeight < height;
  return /* @__PURE__ */ jsxRuntime.jsxs(
    Box.Box,
    {
      ...getStyles("root"),
      id: _id,
      ref,
      "data-has-spoiler": spoiler || void 0,
      ...others,
      children: [
        spoiler && /* @__PURE__ */ jsxRuntime.jsx(
          Anchor.Anchor,
          {
            component: "button",
            type: "button",
            ref: controlRef,
            onClick: () => setShowState(!show),
            "aria-expanded": show,
            "aria-controls": regionId,
            ...getStyles("control"),
            children: spoilerMoreContent
          }
        ),
        /* @__PURE__ */ jsxRuntime.jsx(
          "div",
          {
            ...getStyles("content", {
              style: { maxHeight: !show ? rem.rem(maxHeight) : height ? rem.rem(height) : void 0 }
            }),
            "data-reduce-motion": true,
            role: "region",
            id: regionId,
            children: /* @__PURE__ */ jsxRuntime.jsx("div", { ref: contentRef, children })
          }
        )
      ]
    }
  );
});
Spoiler.classes = Spoiler_module;
Spoiler.displayName = "@mantine/core/Spoiler";

exports.Spoiler = Spoiler;
//# sourceMappingURL=Spoiler.cjs.map
