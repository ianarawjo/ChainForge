'use client';
import { createContext, useContext } from 'react';

const CheckboxGroupContext = createContext(null);
const CheckboxGroupProvider = CheckboxGroupContext.Provider;
const useCheckboxGroupContext = () => useContext(CheckboxGroupContext);

export { CheckboxGroupProvider, useCheckboxGroupContext };
//# sourceMappingURL=CheckboxGroup.context.mjs.map
