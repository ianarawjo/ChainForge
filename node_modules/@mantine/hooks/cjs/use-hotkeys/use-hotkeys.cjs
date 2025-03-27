'use client';
'use strict';

var React = require('react');
var parseHotkey = require('./parse-hotkey.cjs');

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
  React.useEffect(() => {
    const keydownListener = (event) => {
      hotkeys.forEach(
        ([hotkey, handler, options = { preventDefault: true, usePhysicalKeys: false }]) => {
          if (parseHotkey.getHotkeyMatcher(hotkey, options.usePhysicalKeys)(event) && shouldFireEvent(event, tagsToIgnore, triggerOnContentEditable)) {
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

exports.getHotkeyHandler = parseHotkey.getHotkeyHandler;
exports.useHotkeys = useHotkeys;
//# sourceMappingURL=use-hotkeys.cjs.map
