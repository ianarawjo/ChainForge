'use client';
import { createContext, useContext } from 'react';

const TooltipGroupContext = createContext(false);
const TooltipGroupProvider = TooltipGroupContext.Provider;
const useTooltipGroupContext = () => useContext(TooltipGroupContext);

export { TooltipGroupProvider, useTooltipGroupContext };
//# sourceMappingURL=TooltipGroup.context.mjs.map
