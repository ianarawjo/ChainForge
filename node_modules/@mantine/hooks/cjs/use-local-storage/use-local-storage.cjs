'use client';
'use strict';

var createStorage = require('./create-storage.cjs');

function useLocalStorage(props) {
  return createStorage.createStorage("localStorage", "use-local-storage")(props);
}
const readLocalStorageValue = createStorage.readValue("localStorage");

exports.readLocalStorageValue = readLocalStorageValue;
exports.useLocalStorage = useLocalStorage;
//# sourceMappingURL=use-local-storage.cjs.map
