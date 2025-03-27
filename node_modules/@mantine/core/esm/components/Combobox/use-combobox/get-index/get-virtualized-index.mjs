'use client';
function getPreviousIndex({
  currentIndex,
  isOptionDisabled,
  totalOptionsCount,
  loop
}) {
  for (let i = currentIndex - 1; i >= 0; i -= 1) {
    if (!isOptionDisabled(i)) {
      return i;
    }
  }
  if (loop) {
    for (let i = totalOptionsCount - 1; i > -1; i -= 1) {
      if (!isOptionDisabled(i)) {
        return i;
      }
    }
  }
  return currentIndex;
}
function getNextIndex({
  currentIndex,
  isOptionDisabled,
  totalOptionsCount,
  loop
}) {
  for (let i = currentIndex + 1; i < totalOptionsCount; i += 1) {
    if (!isOptionDisabled(i)) {
      return i;
    }
  }
  if (loop) {
    for (let i = 0; i < totalOptionsCount; i += 1) {
      if (!isOptionDisabled(i)) {
        return i;
      }
    }
  }
  return currentIndex;
}
function getFirstIndex({ totalOptionsCount, isOptionDisabled }) {
  for (let i = 0; i < totalOptionsCount; i += 1) {
    if (!isOptionDisabled(i)) {
      return i;
    }
  }
  return -1;
}

export { getFirstIndex, getNextIndex, getPreviousIndex };
//# sourceMappingURL=get-virtualized-index.mjs.map
