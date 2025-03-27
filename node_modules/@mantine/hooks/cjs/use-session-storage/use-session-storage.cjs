'use client';
'use strict';

var createStorage = require('../use-local-storage/create-storage.cjs');

function useSessionStorage(props) {
  return createStorage.createStorage("sessionStorage", "use-session-storage")(props);
}
const readSessionStorageValue = createStorage.readValue("sessionStorage");

exports.readSessionStorageValue = readSessionStorageValue;
exports.useSessionStorage = useSessionStorage;
//# sourceMappingURL=use-session-storage.cjs.map
