'use client';
'use strict';

var React = require('react');

const SwitchGroupContext = React.createContext(null);
const SwitchGroupProvider = SwitchGroupContext.Provider;
const useSwitchGroupContext = () => React.useContext(SwitchGroupContext);

exports.SwitchGroupProvider = SwitchGroupProvider;
exports.useSwitchGroupContext = useSwitchGroupContext;
//# sourceMappingURL=SwitchGroup.context.cjs.map
