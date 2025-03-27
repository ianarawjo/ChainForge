'use client';
'use strict';

function validateJson(value, deserialize) {
  if (typeof value === "string" && value.trim().length === 0) {
    return true;
  }
  try {
    deserialize(value);
    return true;
  } catch (e) {
    return false;
  }
}

exports.validateJson = validateJson;
//# sourceMappingURL=validate-json.cjs.map
