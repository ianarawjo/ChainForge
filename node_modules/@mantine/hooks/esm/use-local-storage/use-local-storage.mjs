'use client';
import { createStorage, readValue } from './create-storage.mjs';

function useLocalStorage(props) {
  return createStorage("localStorage", "use-local-storage")(props);
}
const readLocalStorageValue = readValue("localStorage");

export { readLocalStorageValue, useLocalStorage };
//# sourceMappingURL=use-local-storage.mjs.map
