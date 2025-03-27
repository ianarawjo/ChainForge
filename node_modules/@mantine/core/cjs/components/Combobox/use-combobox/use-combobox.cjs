'use client';
'use strict';

var React = require('react');
var hooks = require('@mantine/hooks');
var getIndex = require('./get-index/get-index.cjs');

function useCombobox({
  defaultOpened,
  opened,
  onOpenedChange,
  onDropdownClose,
  onDropdownOpen,
  loop = true,
  scrollBehavior = "instant"
} = {}) {
  const [dropdownOpened, setDropdownOpened] = hooks.useUncontrolled({
    value: opened,
    defaultValue: defaultOpened,
    finalValue: false,
    onChange: onOpenedChange
  });
  const listId = React.useRef(null);
  const selectedOptionIndex = React.useRef(-1);
  const searchRef = React.useRef(null);
  const targetRef = React.useRef(null);
  const focusSearchTimeout = React.useRef(-1);
  const focusTargetTimeout = React.useRef(-1);
  const selectedIndexUpdateTimeout = React.useRef(-1);
  const openDropdown = React.useCallback(
    (eventSource = "unknown") => {
      if (!dropdownOpened) {
        setDropdownOpened(true);
        onDropdownOpen?.(eventSource);
      }
    },
    [setDropdownOpened, onDropdownOpen, dropdownOpened]
  );
  const closeDropdown = React.useCallback(
    (eventSource = "unknown") => {
      if (dropdownOpened) {
        setDropdownOpened(false);
        onDropdownClose?.(eventSource);
      }
    },
    [setDropdownOpened, onDropdownClose, dropdownOpened]
  );
  const toggleDropdown = React.useCallback(
    (eventSource = "unknown") => {
      if (dropdownOpened) {
        closeDropdown(eventSource);
      } else {
        openDropdown(eventSource);
      }
    },
    [closeDropdown, openDropdown, dropdownOpened]
  );
  const clearSelectedItem = React.useCallback(() => {
    const selected = document.querySelector(`#${listId.current} [data-combobox-selected]`);
    selected?.removeAttribute("data-combobox-selected");
    selected?.removeAttribute("aria-selected");
  }, []);
  const selectOption = React.useCallback(
    (index) => {
      const list = document.getElementById(listId.current);
      const items = list?.querySelectorAll("[data-combobox-option]");
      if (!items) {
        return null;
      }
      const nextIndex = index >= items.length ? 0 : index < 0 ? items.length - 1 : index;
      selectedOptionIndex.current = nextIndex;
      if (items?.[nextIndex] && !items[nextIndex].hasAttribute("data-combobox-disabled")) {
        clearSelectedItem();
        items[nextIndex].setAttribute("data-combobox-selected", "true");
        items[nextIndex].setAttribute("aria-selected", "true");
        items[nextIndex].scrollIntoView({ block: "nearest", behavior: scrollBehavior });
        return items[nextIndex].id;
      }
      return null;
    },
    [scrollBehavior, clearSelectedItem]
  );
  const selectActiveOption = React.useCallback(() => {
    const activeOption = document.querySelector(
      `#${listId.current} [data-combobox-active]`
    );
    if (activeOption) {
      const items = document.querySelectorAll(
        `#${listId.current} [data-combobox-option]`
      );
      const index = Array.from(items).findIndex((option) => option === activeOption);
      return selectOption(index);
    }
    return selectOption(0);
  }, [selectOption]);
  const selectNextOption = React.useCallback(
    () => selectOption(
      getIndex.getNextIndex(
        selectedOptionIndex.current,
        document.querySelectorAll(`#${listId.current} [data-combobox-option]`),
        loop
      )
    ),
    [selectOption, loop]
  );
  const selectPreviousOption = React.useCallback(
    () => selectOption(
      getIndex.getPreviousIndex(
        selectedOptionIndex.current,
        document.querySelectorAll(`#${listId.current} [data-combobox-option]`),
        loop
      )
    ),
    [selectOption, loop]
  );
  const selectFirstOption = React.useCallback(
    () => selectOption(
      getIndex.getFirstIndex(
        document.querySelectorAll(`#${listId.current} [data-combobox-option]`)
      )
    ),
    [selectOption]
  );
  const updateSelectedOptionIndex = React.useCallback(
    (target = "selected", options) => {
      selectedIndexUpdateTimeout.current = window.setTimeout(() => {
        const items = document.querySelectorAll(
          `#${listId.current} [data-combobox-option]`
        );
        const index = Array.from(items).findIndex(
          (option) => option.hasAttribute(`data-combobox-${target}`)
        );
        selectedOptionIndex.current = index;
        if (options?.scrollIntoView) {
          items[index]?.scrollIntoView({ block: "nearest", behavior: scrollBehavior });
        }
      }, 0);
    },
    []
  );
  const resetSelectedOption = React.useCallback(() => {
    selectedOptionIndex.current = -1;
    clearSelectedItem();
  }, [clearSelectedItem]);
  const clickSelectedOption = React.useCallback(() => {
    const items = document.querySelectorAll(
      `#${listId.current} [data-combobox-option]`
    );
    const item = items?.[selectedOptionIndex.current];
    item?.click();
  }, []);
  const setListId = React.useCallback((id) => {
    listId.current = id;
  }, []);
  const focusSearchInput = React.useCallback(() => {
    focusSearchTimeout.current = window.setTimeout(() => searchRef.current.focus(), 0);
  }, []);
  const focusTarget = React.useCallback(() => {
    focusTargetTimeout.current = window.setTimeout(() => targetRef.current.focus(), 0);
  }, []);
  const getSelectedOptionIndex = React.useCallback(() => selectedOptionIndex.current, []);
  React.useEffect(
    () => () => {
      window.clearTimeout(focusSearchTimeout.current);
      window.clearTimeout(focusTargetTimeout.current);
      window.clearTimeout(selectedIndexUpdateTimeout.current);
    },
    []
  );
  return {
    dropdownOpened,
    openDropdown,
    closeDropdown,
    toggleDropdown,
    selectedOptionIndex: selectedOptionIndex.current,
    getSelectedOptionIndex,
    selectOption,
    selectFirstOption,
    selectActiveOption,
    selectNextOption,
    selectPreviousOption,
    resetSelectedOption,
    updateSelectedOptionIndex,
    listId: listId.current,
    setListId,
    clickSelectedOption,
    searchRef,
    focusSearchInput,
    targetRef,
    focusTarget
  };
}

exports.useCombobox = useCombobox;
//# sourceMappingURL=use-combobox.cjs.map
