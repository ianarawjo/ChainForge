'use client';
import { useState, useCallback, useEffect } from 'react';
import { useWindowEvent } from '../use-window-event/use-window-event.mjs';

function getConnection() {
  if (typeof navigator === "undefined") {
    return {};
  }
  const _navigator = navigator;
  const connection = _navigator.connection || _navigator.mozConnection || _navigator.webkitConnection;
  if (!connection) {
    return {};
  }
  return {
    downlink: connection?.downlink,
    downlinkMax: connection?.downlinkMax,
    effectiveType: connection?.effectiveType,
    rtt: connection?.rtt,
    saveData: connection?.saveData,
    type: connection?.type
  };
}
function useNetwork() {
  const [status, setStatus] = useState({
    online: true
  });
  const handleConnectionChange = useCallback(
    () => setStatus((current) => ({ ...current, ...getConnection() })),
    []
  );
  useWindowEvent("online", () => setStatus({ online: true, ...getConnection() }));
  useWindowEvent("offline", () => setStatus({ online: false, ...getConnection() }));
  useEffect(() => {
    const _navigator = navigator;
    if (_navigator.connection) {
      setStatus({ online: _navigator.onLine, ...getConnection() });
      _navigator.connection.addEventListener("change", handleConnectionChange);
      return () => _navigator.connection.removeEventListener("change", handleConnectionChange);
    }
    if (typeof _navigator.onLine === "boolean") {
      setStatus((current) => ({ ...current, online: _navigator.onLine }));
    }
    return void 0;
  }, []);
  return status;
}

export { useNetwork };
//# sourceMappingURL=use-network.mjs.map
