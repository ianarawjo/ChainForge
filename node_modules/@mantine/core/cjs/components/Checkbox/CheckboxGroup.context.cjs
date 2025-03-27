'use client';
'use strict';

var React = require('react');

const CheckboxGroupContext = React.createContext(null);
const CheckboxGroupProvider = CheckboxGroupContext.Provider;
const useCheckboxGroupContext = () => React.useContext(CheckboxGroupContext);

exports.CheckboxGroupProvider = CheckboxGroupProvider;
exports.useCheckboxGroupContext = useCheckboxGroupContext;
//# sourceMappingURL=CheckboxGroup.context.cjs.map
