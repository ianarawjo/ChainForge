'use client';
import { useRef, useCallback, useEffect } from 'react';
import { useUncontrolled } from '@mantine/hooks';
import { getNextIndex, getPreviousIndex, getFirstIndex } from './get-index/get-index.mjs';

function useCombobox({
  defaultOpened,
  opened,
  onOpenedChange,
  onDropdownClose,
  onDropdownOpen,
  loop = true,
  scrollBehavior = "instant"
} = {}) {
  const [dropdownOpened, setDropdownOpened] = useUncontrolled({
    value: opened,
    defaultValue: defaultOpened,
    finalValue: false,
    onChange: onOpenedChange
  });
  const listId = useRef(null);
  const selectedOptionIndex = useRef(-1);
  const searchRef = useRef(null);
  const targetRef = useRef(null);
  const focusSearchTimeout = useRef(-1);
  const focusTargetTimeout = useRef(-1);
  const selectedIndexUpdateTimeout = useRef(-1);
  const openDropdown = useCallback(
    (eventSource = "unknown") => {
      if (!dropdownOpened) {
        setDropdownOpened(true);
        onDropdownOpen?.(eventSource);
      }
    },
    [setDropdownOpened, onDropdownOpen, dropdownOpened]
  );
  const closeDropdown = useCallback(
    (eventSource = "unknown") => {
      if (dropdownOpened) {
        setDropdownOpened(false);
        onDropdownClose?.(eventSource);
      }
    },
    [setDropdownOpened, onDropdownClose, dropdownOpened]
  );
  const toggleDropdown = useCallback(
    (eventSource = "unknown") => {
      if (dropdownOpened) {
        closeDropdown(eventSource);
      } else {
        openDropdown(eventSource);
      }
    },
    [closeDropdown, openDropdown, dropdownOpened]
  );
  const clearSelectedItem = useCallback(() => {
    const selected = document.querySelector(`#${listId.current} [data-combobox-selected]`);
    selected?.removeAttribute("data-combobox-selected");
    selected?.removeAttribute("aria-selected");
  }, []);
  const selectOption = useCallback(
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
  const selectActiveOption = useCallback(() => {
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
  const selectNextOption = useCallback(
    () => selectOption(
      getNextIndex(
        selectedOptionIndex.current,
        document.querySelectorAll(`#${listId.current} [data-combobox-option]`),
        loop
      )
    ),
    [selectOption, loop]
  );
  const selectPreviousOption = useCallback(
    () => selectOption(
      getPreviousIndex(
        selectedOptionIndex.current,
        document.querySelectorAll(`#${listId.current} [data-combobox-option]`),
        loop
      )
    ),
    [selectOption, loop]
  );
  const selectFirstOption = useCallback(
    () => selectOption(
      getFirstIndex(
        document.querySelectorAll(`#${listId.current} [data-combobox-option]`)
      )
    ),
    [selectOption]
  );
  const updateSelectedOptionIndex = useCallback(
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
  const resetSelectedOption = useCallback(() => {
    selectedOptionIndex.current = -1;
    clearSelectedItem();
  }, [clearSelectedItem]);
  const clickSelectedOption = useCallback(() => {
    const items = document.querySelectorAll(
      `#${listId.current} [data-combobox-option]`
    );
    const item = items?.[selectedOptionIndex.current];
    item?.click();
  }, []);
  const setListId = useCallback((id) => {
    listId.current = id;
  }, []);
  const focusSearchInput = useCallback(() => {
    focusSearchTimeout.current = window.setTimeout(() => searchRef.current.focus(), 0);
  }, []);
  const focusTarget = useCallback(() => {
    focusTargetTimeout.current = window.setTimeout(() => targetRef.current.focus(), 0);
  }, []);
  const getSelectedOptionIndex = useCallback(() => selectedOptionIndex.current, []);
  useEffect(
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

export { useCombobox };
//# sourceMappingURL=use-combobox.mjs.map
