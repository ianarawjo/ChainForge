'use client';
import { useRef, useEffect, useCallback } from 'react';
import { useUncontrolled } from '@mantine/hooks';
import { getNextIndex, getPreviousIndex, getFirstIndex } from './get-index/get-virtualized-index.mjs';

function useVirtualizedCombobox({
  defaultOpened,
  opened,
  onOpenedChange,
  onDropdownClose,
  onDropdownOpen,
  loop = true,
  totalOptionsCount,
  isOptionDisabled = () => false,
  getOptionId,
  selectedOptionIndex,
  setSelectedOptionIndex,
  activeOptionIndex,
  onSelectedOptionSubmit
} = {
  totalOptionsCount: 0,
  getOptionId: () => null,
  selectedOptionIndex: 1,
  setSelectedOptionIndex: () => {
  },
  onSelectedOptionSubmit: () => {
  }
}) {
  const [dropdownOpened, setDropdownOpened] = useUncontrolled({
    value: opened,
    defaultValue: defaultOpened,
    finalValue: false,
    onChange: onOpenedChange
  });
  const listId = useRef(null);
  const searchRef = useRef(null);
  const targetRef = useRef(null);
  const focusSearchTimeout = useRef(-1);
  const focusTargetTimeout = useRef(-1);
  const openDropdown = () => {
    if (!dropdownOpened) {
      setDropdownOpened(true);
      onDropdownOpen?.();
    }
  };
  const closeDropdown = () => {
    if (dropdownOpened) {
      setDropdownOpened(false);
      onDropdownClose?.();
    }
  };
  const toggleDropdown = () => {
    if (dropdownOpened) {
      closeDropdown();
    } else {
      openDropdown();
    }
  };
  const selectOption = (index) => {
    const nextIndex = index >= totalOptionsCount ? 0 : index < 0 ? totalOptionsCount - 1 : index;
    setSelectedOptionIndex(nextIndex);
    return getOptionId(nextIndex);
  };
  const selectActiveOption = () => selectOption(activeOptionIndex ?? 0);
  const selectNextOption = () => selectOption(
    getNextIndex({ currentIndex: selectedOptionIndex, isOptionDisabled, totalOptionsCount, loop })
  );
  const selectPreviousOption = () => selectOption(
    getPreviousIndex({
      currentIndex: selectedOptionIndex,
      isOptionDisabled,
      totalOptionsCount,
      loop
    })
  );
  const selectFirstOption = () => selectOption(getFirstIndex({ isOptionDisabled, totalOptionsCount }));
  const resetSelectedOption = () => {
    setSelectedOptionIndex(-1);
  };
  const clickSelectedOption = () => {
    onSelectedOptionSubmit?.(selectedOptionIndex);
  };
  const setListId = (id) => {
    listId.current = id;
  };
  const focusSearchInput = () => {
    focusSearchTimeout.current = window.setTimeout(() => searchRef.current.focus(), 0);
  };
  const focusTarget = () => {
    focusTargetTimeout.current = window.setTimeout(() => targetRef.current.focus(), 0);
  };
  useEffect(
    () => () => {
      window.clearTimeout(focusSearchTimeout.current);
      window.clearTimeout(focusTargetTimeout.current);
    },
    []
  );
  const getSelectedOptionIndex = useCallback(() => selectedOptionIndex, []);
  return {
    dropdownOpened,
    openDropdown,
    closeDropdown,
    toggleDropdown,
    selectedOptionIndex,
    getSelectedOptionIndex,
    selectOption,
    selectFirstOption,
    selectActiveOption,
    selectNextOption,
    selectPreviousOption,
    resetSelectedOption,
    updateSelectedOptionIndex: () => {
    },
    listId: listId.current,
    setListId,
    clickSelectedOption,
    searchRef,
    focusSearchInput,
    targetRef,
    focusTarget
  };
}

export { useVirtualizedCombobox };
//# sourceMappingURL=use-virtualized-combobox.mjs.map
