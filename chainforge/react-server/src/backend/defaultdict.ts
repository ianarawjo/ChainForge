/**
 * A dictionary that uses a default value when a key is not found.
 * 
 * Example usage:
 * const dict = new DefaultDict(() => 0);
 * dict["a"] = 1;
 * console.log(dict["a"]);  // 1
 * console.log(dict["b"]);  // 0
 */

class DefaultDict {
  constructor(defaultFactory) {
    return new Proxy({}, {
      get: (target, name) => (name in target && target[name] != null) ? target[name] : defaultFactory()
    })
  }
}

export default DefaultDict;