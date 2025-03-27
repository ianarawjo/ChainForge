'use client';
function linearScale(input, output) {
  return (value) => {
    if (input[0] === input[1] || output[0] === output[1]) {
      return output[0];
    }
    const ratio = (output[1] - output[0]) / (input[1] - input[0]);
    return output[0] + ratio * (value - input[0]);
  };
}

export { linearScale };
//# sourceMappingURL=linear-scale.mjs.map
