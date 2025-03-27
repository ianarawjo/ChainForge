'use client';
import { jsxs, jsx } from 'react/jsx-runtime';
import { useId, useUncontrolled, useElementSize } from '@mantine/hooks';
import { rem } from '../../core/utils/units-converters/rem.mjs';
import 'react';
import { createVarsResolver } from '../../core/styles-api/create-vars-resolver/create-vars-resolver.mjs';
import 'clsx';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../core/MantineProvider/use-props/use-props.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { useStyles } from '../../core/styles-api/use-styles/use-styles.mjs';
import { Box } from '../../core/Box/Box.mjs';
import { factory } from '../../core/factory/factory.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import { Anchor } from '../Anchor/Anchor.mjs';
import classes from './Spoiler.module.css.mjs';

const defaultProps = {
  maxHeight: 100,
  initialState: false
};
const varsResolver = createVarsResolver((_, { transitionDuration }) => ({
  root: {
    "--spoiler-transition-duration": transitionDuration !== void 0 ? `${transitionDuration}ms` : void 0
  }
}));
const Spoiler = factory((_props, ref) => {
  const props = useProps("Spoiler", defaultProps, _props);
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
  const getStyles = useStyles({
    name: "Spoiler",
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
  const _id = useId(id);
  const regionId = `${_id}-region`;
  const [show, setShowState] = useUncontrolled({
    value: expanded,
    defaultValue: initialState,
    finalValue: false,
    onChange: onExpandedChange
  });
  const { ref: contentRef, height } = useElementSize();
  const spoilerMoreContent = show ? hideLabel : showLabel;
  const spoiler = spoilerMoreContent !== null && maxHeight < height;
  return /* @__PURE__ */ jsxs(
    Box,
    {
      ...getStyles("root"),
      id: _id,
      ref,
      "data-has-spoiler": spoiler || void 0,
      ...others,
      children: [
        spoiler && /* @__PURE__ */ jsx(
          Anchor,
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
        /* @__PURE__ */ jsx(
          "div",
          {
            ...getStyles("content", {
              style: { maxHeight: !show ? rem(maxHeight) : height ? rem(height) : void 0 }
            }),
            "data-reduce-motion": true,
            role: "region",
            id: regionId,
            children: /* @__PURE__ */ jsx("div", { ref: contentRef, children })
          }
        )
      ]
    }
  );
});
Spoiler.classes = classes;
Spoiler.displayName = "@mantine/core/Spoiler";

export { Spoiler };
//# sourceMappingURL=Spoiler.mjs.map
