'use client';
import { createStorage, readValue } from '../use-local-storage/create-storage.mjs';

function useSessionStorage(props) {
  return createStorage("sessionStorage", "use-session-storage")(props);
}
const readSessionStorageValue = readValue("sessionStorage");

export { readSessionStorageValue, useSessionStorage };
//# sourceMappingURL=use-session-storage.mjs.map
