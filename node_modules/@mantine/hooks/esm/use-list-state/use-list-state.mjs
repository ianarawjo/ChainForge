'use client';
import { useState } from 'react';

function useListState(initialValue = []) {
  const [state, setState] = useState(initialValue);
  const append = (...items) => setState((current) => [...current, ...items]);
  const prepend = (...items) => setState((current) => [...items, ...current]);
  const insert = (index, ...items) => setState((current) => [...current.slice(0, index), ...items, ...current.slice(index)]);
  const apply = (fn) => setState((current) => current.map((item, index) => fn(item, index)));
  const remove = (...indices) => setState((current) => current.filter((_, index) => !indices.includes(index)));
  const pop = () => setState((current) => {
    const cloned = [...current];
    cloned.pop();
    return cloned;
  });
  const shift = () => setState((current) => {
    const cloned = [...current];
    cloned.shift();
    return cloned;
  });
  const reorder = ({ from, to }) => setState((current) => {
    const cloned = [...current];
    const item = current[from];
    cloned.splice(from, 1);
    cloned.splice(to, 0, item);
    return cloned;
  });
  const swap = ({ from, to }) => setState((current) => {
    const cloned = [...current];
    const fromItem = cloned[from];
    const toItem = cloned[to];
    cloned.splice(to, 1, fromItem);
    cloned.splice(from, 1, toItem);
    return cloned;
  });
  const setItem = (index, item) => setState((current) => {
    const cloned = [...current];
    cloned[index] = item;
    return cloned;
  });
  const setItemProp = (index, prop, value) => setState((current) => {
    const cloned = [...current];
    cloned[index] = { ...cloned[index], [prop]: value };
    return cloned;
  });
  const applyWhere = (condition, fn) => setState(
    (current) => current.map((item, index) => condition(item, index) ? fn(item, index) : item)
  );
  const filter = (fn) => {
    setState((current) => current.filter(fn));
  };
  return [
    state,
    {
      setState,
      append,
      prepend,
      insert,
      pop,
      shift,
      apply,
      applyWhere,
      remove,
      reorder,
      swap,
      setItem,
      setItemProp,
      filter
    }
  ];
}

export { useListState };
//# sourceMappingURL=use-list-state.mjs.map
