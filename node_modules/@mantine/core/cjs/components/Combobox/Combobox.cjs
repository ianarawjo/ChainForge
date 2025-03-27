'use client';
'use strict';

var jsxRuntime = require('react/jsx-runtime');
var rem = require('../../core/utils/units-converters/rem.cjs');
require('react');
var getSize = require('../../core/utils/get-size/get-size.cjs');
require('@mantine/hooks');
var createVarsResolver = require('../../core/styles-api/create-vars-resolver/create-vars-resolver.cjs');
require('clsx');
require('../../core/MantineProvider/Mantine.context.cjs');
require('../../core/MantineProvider/default-theme.cjs');
require('../../core/MantineProvider/MantineProvider.cjs');
require('../../core/MantineProvider/MantineThemeProvider/MantineThemeProvider.cjs');
var useProps = require('../../core/MantineProvider/use-props/use-props.cjs');
require('../../core/MantineProvider/MantineCssVariables/MantineCssVariables.cjs');
var useStyles = require('../../core/styles-api/use-styles/use-styles.cjs');
require('../../core/Box/Box.cjs');
require('../../core/DirectionProvider/DirectionProvider.cjs');
var Popover = require('../Popover/Popover.cjs');
require('../Popover/PopoverDropdown/PopoverDropdown.cjs');
require('../Popover/PopoverTarget/PopoverTarget.cjs');
var Combobox_context = require('./Combobox.context.cjs');
var ComboboxChevron = require('./ComboboxChevron/ComboboxChevron.cjs');
var ComboboxClearButton = require('./ComboboxClearButton/ComboboxClearButton.cjs');
var ComboboxDropdown = require('./ComboboxDropdown/ComboboxDropdown.cjs');
var ComboboxDropdownTarget = require('./ComboboxDropdownTarget/ComboboxDropdownTarget.cjs');
var ComboboxEmpty = require('./ComboboxEmpty/ComboboxEmpty.cjs');
var ComboboxEventsTarget = require('./ComboboxEventsTarget/ComboboxEventsTarget.cjs');
var ComboboxFooter = require('./ComboboxFooter/ComboboxFooter.cjs');
var ComboboxGroup = require('./ComboboxGroup/ComboboxGroup.cjs');
var ComboboxHeader = require('./ComboboxHeader/ComboboxHeader.cjs');
var ComboboxHiddenInput = require('./ComboboxHiddenInput/ComboboxHiddenInput.cjs');
var ComboboxOption = require('./ComboboxOption/ComboboxOption.cjs');
var ComboboxOptions = require('./ComboboxOptions/ComboboxOptions.cjs');
var ComboboxSearch = require('./ComboboxSearch/ComboboxSearch.cjs');
var ComboboxTarget = require('./ComboboxTarget/ComboboxTarget.cjs');
var useCombobox = require('./use-combobox/use-combobox.cjs');
var Combobox_module = require('./Combobox.module.css.cjs');

const defaultProps = {
  keepMounted: true,
  withinPortal: true,
  resetSelectionOnOptionHover: false,
  width: "target",
  transitionProps: { transition: "fade", duration: 0 }
};
const varsResolver = createVarsResolver.createVarsResolver((_, { size, dropdownPadding }) => ({
  options: {
    "--combobox-option-fz": getSize.getFontSize(size),
    "--combobox-option-padding": getSize.getSize(size, "combobox-option-padding")
  },
  dropdown: {
    "--combobox-padding": dropdownPadding === void 0 ? void 0 : rem.rem(dropdownPadding),
    "--combobox-option-fz": getSize.getFontSize(size),
    "--combobox-option-padding": getSize.getSize(size, "combobox-option-padding")
  }
}));
function Combobox(_props) {
  const props = useProps.useProps("Combobox", defaultProps, _props);
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
  const uncontrolledStore = useCombobox.useCombobox();
  const store = controlledStore || uncontrolledStore;
  const getStyles = useStyles.useStyles({
    name: __staticSelector || "Combobox",
    classes: Combobox_module,
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
  return /* @__PURE__ */ jsxRuntime.jsx(
    Combobox_context.ComboboxProvider,
    {
      value: {
        getStyles,
        store,
        onOptionSubmit,
        size,
        resetSelectionOnOptionHover,
        readOnly
      },
      children: /* @__PURE__ */ jsxRuntime.jsx(
        Popover.Popover,
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
Combobox.classes = Combobox_module;
Combobox.displayName = "@mantine/core/Combobox";
Combobox.Target = ComboboxTarget.ComboboxTarget;
Combobox.Dropdown = ComboboxDropdown.ComboboxDropdown;
Combobox.Options = ComboboxOptions.ComboboxOptions;
Combobox.Option = ComboboxOption.ComboboxOption;
Combobox.Search = ComboboxSearch.ComboboxSearch;
Combobox.Empty = ComboboxEmpty.ComboboxEmpty;
Combobox.Chevron = ComboboxChevron.ComboboxChevron;
Combobox.Footer = ComboboxFooter.ComboboxFooter;
Combobox.Header = ComboboxHeader.ComboboxHeader;
Combobox.EventsTarget = ComboboxEventsTarget.ComboboxEventsTarget;
Combobox.DropdownTarget = ComboboxDropdownTarget.ComboboxDropdownTarget;
Combobox.Group = ComboboxGroup.ComboboxGroup;
Combobox.ClearButton = ComboboxClearButton.ComboboxClearButton;
Combobox.HiddenInput = ComboboxHiddenInput.ComboboxHiddenInput;

exports.Combobox = Combobox;
//# sourceMappingURL=Combobox.cjs.map
