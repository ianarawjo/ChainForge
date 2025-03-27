'use client';
import { useState, useRef, useCallback } from 'react';
import { useIsomorphicEffect } from '../use-isomorphic-effect/use-isomorphic-effect.mjs';

const defaultOptions = {
  multiple: true,
  accept: "*"
};
function getInitialFilesList(files) {
  if (!files) {
    return null;
  }
  if (files instanceof FileList) {
    return files;
  }
  const result = new DataTransfer();
  for (const file of files) {
    result.items.add(file);
  }
  return result.files;
}
function createInput(options) {
  if (typeof document === "undefined") {
    return null;
  }
  const input = document.createElement("input");
  input.type = "file";
  if (options.accept) {
    input.accept = options.accept;
  }
  if (options.multiple) {
    input.multiple = options.multiple;
  }
  if (options.capture) {
    input.capture = options.capture;
  }
  if (options.directory) {
    input.webkitdirectory = options.directory;
  }
  input.style.display = "none";
  return input;
}
function useFileDialog(input = {}) {
  const options = { ...defaultOptions, ...input };
  const [files, setFiles] = useState(getInitialFilesList(options.initialFiles));
  const inputRef = useRef(null);
  const handleChange = useCallback(
    (event) => {
      const target = event.target;
      if (target?.files) {
        setFiles(target.files);
        options.onChange?.(target.files);
      }
    },
    [options.onChange]
  );
  const createAndSetupInput = useCallback(() => {
    inputRef.current?.remove();
    inputRef.current = createInput(options);
    if (inputRef.current) {
      inputRef.current.addEventListener("change", handleChange, { once: true });
      document.body.appendChild(inputRef.current);
    }
  }, [options, handleChange]);
  useIsomorphicEffect(() => {
    createAndSetupInput();
    return () => inputRef.current?.remove();
  }, []);
  const reset = useCallback(() => {
    setFiles(null);
    options.onChange?.(null);
  }, [options.onChange]);
  const open = useCallback(() => {
    if (options.resetOnOpen) {
      reset();
    }
    createAndSetupInput();
    inputRef.current?.click();
  }, [options.resetOnOpen, reset, createAndSetupInput]);
  return { files, open, reset };
}

export { useFileDialog };
//# sourceMappingURL=use-file-dialog.mjs.map
