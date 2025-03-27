'use client';
'use strict';

var React = require('react');

const AvatarGroupContext = React.createContext(null);
const AvatarGroupProvider = AvatarGroupContext.Provider;
function useAvatarGroupContext() {
  const ctx = React.useContext(AvatarGroupContext);
  return { withinGroup: !!ctx };
}

exports.AvatarGroupProvider = AvatarGroupProvider;
exports.useAvatarGroupContext = useAvatarGroupContext;
//# sourceMappingURL=AvatarGroup.context.cjs.map
