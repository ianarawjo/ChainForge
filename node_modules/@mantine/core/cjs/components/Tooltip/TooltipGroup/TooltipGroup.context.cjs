'use client';
'use strict';

var React = require('react');

const TooltipGroupContext = React.createContext(false);
const TooltipGroupProvider = TooltipGroupContext.Provider;
const useTooltipGroupContext = () => React.useContext(TooltipGroupContext);

exports.TooltipGroupProvider = TooltipGroupProvider;
exports.useTooltipGroupContext = useTooltipGroupContext;
//# sourceMappingURL=TooltipGroup.context.cjs.map
