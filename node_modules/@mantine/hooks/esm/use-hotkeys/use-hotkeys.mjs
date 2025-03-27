'use client';
import { useEffect } from 'react';
import { getHotkeyMatcher } from './parse-hotkey.mjs';
export { getHotkeyHandler } from './parse-hotkey.mjs';

function shouldFireEvent(event, tagsToIgnore, triggerOnContentEditable = false) {
  if (event.target instanceof HTMLElement) {
    if (triggerOnContentEditable) {
      return !tagsToIgnore.includes(event.target.tagName);
    }
    return !event.target.isContentEditable && !tagsToIgnore.includes(event.target.tagName);
  }
  return true;
}
function useHotkeys(hotkeys, tagsToIgnore = ["INPUT", "TEXTAREA", "SELECT"], triggerOnContentEditable = false) {
  useEffect(() => {
    const keydownListener = (event) => {
      hotkeys.forEach(
        ([hotkey, handler, options = { preventDefault: true, usePhysicalKeys: false }]) => {
          if (getHotkeyMatcher(hotkey, options.usePhysicalKeys)(event) && shouldFireEvent(event, tagsToIgnore, triggerOnContentEditable)) {
            if (options.preventDefault) {
              event.preventDefault();
            }
            handler(event);
          }
        }
      );
    };
    document.documentElement.addEventListener("keydown", keydownListener);
    return () => document.documentElement.removeEventListener("keydown", keydownListener);
  }, [hotkeys]);
}

export { useHotkeys };
//# sourceMappingURL=use-hotkeys.mjs.map
