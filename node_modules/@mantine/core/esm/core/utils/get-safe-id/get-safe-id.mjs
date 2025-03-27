'use client';
function getSafeId(uid, errorMessage) {
  return (value) => {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error(errorMessage);
    }
    return `${uid}-${value}`;
  };
}

export { getSafeId };
//# sourceMappingURL=get-safe-id.mjs.map
