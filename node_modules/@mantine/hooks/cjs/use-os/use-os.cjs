'use client';
'use strict';

var React = require('react');
var useIsomorphicEffect = require('../use-isomorphic-effect/use-isomorphic-effect.cjs');

function isMacOS(userAgent) {
  const macosPattern = /(Macintosh)|(MacIntel)|(MacPPC)|(Mac68K)/i;
  return macosPattern.test(userAgent);
}
function isIOS(userAgent) {
  const iosPattern = /(iPhone)|(iPad)|(iPod)/i;
  return iosPattern.test(userAgent);
}
function isWindows(userAgent) {
  const windowsPattern = /(Win32)|(Win64)|(Windows)|(WinCE)/i;
  return windowsPattern.test(userAgent);
}
function isAndroid(userAgent) {
  const androidPattern = /Android/i;
  return androidPattern.test(userAgent);
}
function isLinux(userAgent) {
  const linuxPattern = /Linux/i;
  return linuxPattern.test(userAgent);
}
function getOS() {
  if (typeof window === "undefined") {
    return "undetermined";
  }
  const { userAgent } = window.navigator;
  if (isIOS(userAgent) || isMacOS(userAgent) && "ontouchend" in document) {
    return "ios";
  }
  if (isMacOS(userAgent)) {
    return "macos";
  }
  if (isWindows(userAgent)) {
    return "windows";
  }
  if (isAndroid(userAgent)) {
    return "android";
  }
  if (isLinux(userAgent)) {
    return "linux";
  }
  return "undetermined";
}
function useOs(options = { getValueInEffect: true }) {
  const [value, setValue] = React.useState(options.getValueInEffect ? "undetermined" : getOS());
  useIsomorphicEffect.useIsomorphicEffect(() => {
    if (options.getValueInEffect) {
      setValue(getOS);
    }
  }, []);
  return value;
}

exports.useOs = useOs;
//# sourceMappingURL=use-os.cjs.map
