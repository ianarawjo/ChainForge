'use client';
function getNextMarkValue(currentValue, marks) {
  const sortedMarks = [...marks].sort((a, b) => a.value - b.value);
  const nextMark = sortedMarks.find((mark) => mark.value > currentValue);
  return nextMark ? nextMark.value : currentValue;
}
function getPreviousMarkValue(currentValue, marks) {
  const sortedMarks = [...marks].sort((a, b) => b.value - a.value);
  const previousMark = sortedMarks.find((mark) => mark.value < currentValue);
  return previousMark ? previousMark.value : currentValue;
}
function getFirstMarkValue(marks) {
  const sortedMarks = [...marks].sort((a, b) => a.value - b.value);
  return sortedMarks.length > 0 ? sortedMarks[0].value : 0;
}
function getLastMarkValue(marks) {
  const sortedMarks = [...marks].sort((a, b) => a.value - b.value);
  return sortedMarks.length > 0 ? sortedMarks[sortedMarks.length - 1].value : 100;
}

export { getFirstMarkValue, getLastMarkValue, getNextMarkValue, getPreviousMarkValue };
//# sourceMappingURL=get-step-mark-value.mjs.map
