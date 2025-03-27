'use client';
import { jsx } from 'react/jsx-runtime';
import { rem } from '../../core/utils/units-converters/rem.mjs';
import 'react';
import { getFontSize, getSize } from '../../core/utils/get-size/get-size.mjs';
import '@mantine/hooks';
import { createVarsResolver } from '../../core/styles-api/create-vars-resolver/create-vars-resolver.mjs';
import 'clsx';
import '../../core/MantineProvider/Mantine.context.mjs';
import '../../core/MantineProvider/default-theme.mjs';
import '../../core/MantineProvider/MantineProvider.mjs';
import '../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.mjs';
import { useProps } from '../../core/MantineProvider/use-props/use-props.mjs';
import '../../core/MantineProvider/MantineCssVariables/MantineCssVariables.mjs';
import { useStyles } from '../../core/styles-api/use-styles/use-styles.mjs';
import '../../core/Box/Box.mjs';
import '../../core/DirectionProvider/DirectionProvider.mjs';
import { Popover } from '../Popover/Popover.mjs';
import '../Popover/PopoverDropdown/PopoverDropdown.mjs';
import '../Popover/PopoverTarget/PopoverTarget.mjs';
import { ComboboxProvider } from './Combobox.context.mjs';
import { ComboboxChevron } from './ComboboxChevron/ComboboxChevron.mjs';
import { ComboboxClearButton } from './ComboboxClearButton/ComboboxClearButton.mjs';
import { ComboboxDropdown } from './ComboboxDropdown/ComboboxDropdown.mjs';
import { ComboboxDropdownTarget } from './ComboboxDropdownTarget/ComboboxDropdownTarget.mjs';
import { ComboboxEmpty } from './ComboboxEmpty/ComboboxEmpty.mjs';
import { ComboboxEventsTarget } from './ComboboxEventsTarget/ComboboxEventsTarget.mjs';
import { ComboboxFooter } from './ComboboxFooter/ComboboxFooter.mjs';
import { ComboboxGroup } from './ComboboxGroup/ComboboxGroup.mjs';
import { ComboboxHeader } from './ComboboxHeader/ComboboxHeader.mjs';
import { ComboboxHiddenInput } from './ComboboxHiddenInput/ComboboxHiddenInput.mjs';
import { ComboboxOption } from './ComboboxOption/ComboboxOption.mjs';
import { ComboboxOptions } from './ComboboxOptions/ComboboxOptions.mjs';
import { ComboboxSearch } from './ComboboxSearch/ComboboxSearch.mjs';
import { ComboboxTarget } from './ComboboxTarget/ComboboxTarget.mjs';
import { useCombobox } from './use-combobox/use-combobox.mjs';
import classes from './Combobox.module.css.mjs';

const defaultProps = {
  keepMounted: true,
  withinPortal: true,
  resetSelectionOnOptionHover: false,
  width: "target",
  transitionProps: { transition: "fade", duration: 0 }
};
const varsResolver = createVarsResolver((_, { size, dropdownPadding }) => ({
  options: {
    "--combobox-option-fz": getFontSize(size),
    "--combobox-option-padding": getSize(size, "combobox-option-padding")
  },
  dropdown: {
    "--combobox-padding": dropdownPadding === void 0 ? void 0 : rem(dropdownPadding),
    "--combobox-option-fz": getFontSize(size),
    "--combobox-option-padding": getSize(size, "combobox-option-padding")
  }
}));
function Combobox(_props) {
  const props = useProps("Combobox", defaultProps, _props);
  const {
    classNames,
    styles,
    unstyled,
    children,
    store: controlledStore,
    vars,
    onOptionSubmit,
    onClose,
    size,
    dropdownPadding,
    resetSelectionOnOptionHover,
    __staticSelector,
    readOnly,
    ...others
  } = props;
  const uncontrolledStore = useCombobox();
  const store = controlledStore || uncontrolledStore;
  const getStyles = useStyles({
    name: __staticSelector || "Combobox",
    classes,
    props,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver
  });
  const onDropdownClose = () => {
    onClose?.();
    store.closeDropdown();
  };
  return /* @__PURE__ */ jsx(
    ComboboxProvider,
    {
      value: {
        getStyles,
        store,
        onOptionSubmit,
        size,
        resetSelectionOnOptionHover,
        readOnly
      },
      children: /* @__PURE__ */ jsx(
        Popover,
        {
          opened: store.dropdownOpened,
          ...others,
          onChange: (_opened) => !_opened && onDropdownClose(),
          withRoles: false,
          unstyled,
          children
        }
      )
    }
  );
}
const extendCombobox = (c) => c;
Combobox.extend = extendCombobox;
Combobox.classes = classes;
Combobox.displayName = "@mantine/core/Combobox";
Combobox.Target = ComboboxTarget;
Combobox.Dropdown = ComboboxDropdown;
Combobox.Options = ComboboxOptions;
Combobox.Option = ComboboxOption;
Combobox.Search = ComboboxSearch;
Combobox.Empty = ComboboxEmpty;
Combobox.Chevron = ComboboxChevron;
Combobox.Footer = ComboboxFooter;
Combobox.Header = ComboboxHeader;
Combobox.EventsTarget = ComboboxEventsTarget;
Combobox.DropdownTarget = ComboboxDropdownTarget;
Combobox.Group = ComboboxGroup;
Combobox.ClearButton = ComboboxClearButton;
Combobox.HiddenInput = ComboboxHiddenInput;

export { Combobox };
//# sourceMappingURL=Combobox.mjs.map
