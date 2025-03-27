'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var React = require('react');
require('@mantine/hooks');
require('clsx');
require('../../../core/MantineProvider/Mantine.context.cjs');
require('../../../core/MantineProvider/default-theme.cjs');
require('../../../core/MantineProvider/MantineProvider.cjs');
require('../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
require('../../../core/Box/Box.cjs');
var DirectionProvider = require('../../../core/DirectionProvider/DirectionProvider.cjs');
var getArrowPositionStyles = require('./get-arrow-position-styles.cjs');

const FloatingArrow = React.forwardRef(
  ({
    position,
    arrowSize,
    arrowOffset,
    arrowRadius,
    arrowPosition,
    visible,
    arrowX,
    arrowY,
    style,
    ...others
  }, ref) => {
    const { dir } = DirectionProvider.useDirection();
    if (!visible) {
      return null;
    }
    return /* @__PURE__ */ jsxRuntime.jsx(
      "div",
      {
        ...others,
        ref,
        style: {
          ...style,
          ...getArrowPositionStyles.getArrowPositionStyles({
            position,
            arrowSize,
            arrowOffset,
            arrowRadius,
            arrowPosition,
            dir,
            arrowX,
            arrowY
          })
        }
      }
    );
  }
);
FloatingArrow.displayName = "@mantine/core/FloatingArrow";

exports.FloatingArrow = FloatingArrow;
//# sourceMappingURL=FloatingArrow.cjs.map
