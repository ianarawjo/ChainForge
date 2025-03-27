'use client';
import { createContext, useContext } from 'react';

const AvatarGroupContext = createContext(null);
const AvatarGroupProvider = AvatarGroupContext.Provider;
function useAvatarGroupContext() {
  const ctx = useContext(AvatarGroupContext);
  return { withinGroup: !!ctx };
}

export { AvatarGroupProvider, useAvatarGroupContext };
//# sourceMappingURL=AvatarGroup.context.mjs.map
