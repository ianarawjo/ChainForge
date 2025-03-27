'use client';
'use strict';

require('react');
var createSafeContext = require('../../../core/utils/create-safe-context/create-safe-context.cjs');
require('react/jsx-runtime');
require('@mantine/hooks');
require('clsx');
require('../../../core/MantineProvider/Mantine.context.cjs');
require('../../../core/MantineProvider/default-theme.cjs');
require('../../../core/MantineProvider/MantineProvider.cjs');
require('../../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
require('../../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
require('../../../core/Box/Box.cjs');
require('../../../core/DirectionProvider/DirectionProvider.cjs');

const [ScrollbarProvider, useScrollbarContext] = createSafeContext.createSafeContext(
  "ScrollAreaScrollbar was not found in tree"
);

exports.ScrollbarProvider = ScrollbarProvider;
exports.useScrollbarContext = useScrollbarContext;
//# sourceMappingURL=Scrollbar.context.cjs.map
