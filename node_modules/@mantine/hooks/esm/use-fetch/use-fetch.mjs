'use client';
import { useState, useRef, useCallback, useEffect } from 'react';

function useFetch(url, { autoInvoke = true, ...options } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const controller = useRef(null);
  const refetch = useCallback(() => {
    if (!url) {
      return;
    }
    if (controller.current) {
      controller.current.abort();
    }
    controller.current = new AbortController();
    setLoading(true);
    return fetch(url, { signal: controller.current.signal, ...options }).then((res) => res.json()).then((res) => {
      setData(res);
      setLoading(false);
      return res;
    }).catch((err) => {
      setLoading(false);
      if (err.name !== "AbortError") {
        setError(err);
      }
      return err;
    });
  }, [url]);
  const abort = useCallback(() => {
    if (controller.current) {
      controller.current?.abort("");
    }
  }, []);
  useEffect(() => {
    if (autoInvoke) {
      refetch();
    }
    return () => {
      if (controller.current) {
        controller.current.abort("");
      }
    };
  }, [refetch, autoInvoke]);
  return { data, loading, error, refetch, abort };
}

export { useFetch };
//# sourceMappingURL=use-fetch.mjs.map
