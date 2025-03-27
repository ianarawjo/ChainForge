'use client';
function getOptionsLockup(options) {
  return options.reduce((acc, item) => {
    if ("group" in item) {
      return { ...acc, ...getOptionsLockup(item.items) };
    }
    acc[item.value] = item;
    return acc;
  }, {});
}
function getLabelsLockup(options) {
  return options.reduce((acc, item) => {
    if ("group" in item) {
      return { ...acc, ...getLabelsLockup(item.items) };
    }
    acc[item.label] = item;
    return acc;
  }, {});
}

export { getLabelsLockup, getOptionsLockup };
//# sourceMappingURL=get-options-lockup.mjs.map
