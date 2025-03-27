'use client';
'use strict';

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

exports.getFirstMarkValue = getFirstMarkValue;
exports.getLastMarkValue = getLastMarkValue;
exports.getNextMarkValue = getNextMarkValue;
exports.getPreviousMarkValue = getPreviousMarkValue;
//# sourceMappingURL=get-step-mark-value.cjs.map
