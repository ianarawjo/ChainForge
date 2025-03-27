import React, { SyntheticEvent } from 'react';
export declare type Timeout = ReturnType<typeof setTimeout>;
export interface NumberFormatState {
    value?: string;
    numAsString?: string;
    mounted: boolean;
}
export interface NumberFormatValues {
    floatValue: number | undefined;
    formattedValue: string;
    value: string;
}
export declare enum SourceType {
    event = "event",
    props = "prop"
}
export interface SourceInfo {
    event?: SyntheticEvent<HTMLInputElement>;
    source: SourceType;
}
export declare type FormatInputValueFunction = (inputValue: string) => string;
export declare type RemoveFormattingFunction = (inputValue: string, changeMeta?: ChangeMeta) => string;
export interface SyntheticInputEvent extends React.SyntheticEvent<HTMLInputElement> {
    readonly target: HTMLInputElement;
    data: any;
}
export declare type ChangeMeta = {
    from: {
        start: number;
        end: number;
    };
    to: {
        start: number;
        end: number;
    };
    lastValue: string;
};
export declare type InputAttributes = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'defaultValue' | 'value' | 'children'>;
declare type NumberFormatProps<Props, BaseType = InputAttributes> = Props & Omit<InputAttributes, keyof BaseType> & Omit<BaseType, keyof Props | 'ref'> & {
    customInput?: React.ComponentType<BaseType>;
};
export declare type OnValueChange = (values: NumberFormatValues, sourceInfo: SourceInfo) => void;
export declare type IsCharacterSame = (compareProps: {
    currentValue: string;
    lastValue: string;
    formattedValue: string;
    currentValueIndex: number;
    formattedValueIndex: number;
}) => boolean;
declare type NumberFormatBase = {
    type?: 'text' | 'tel' | 'password';
    displayType?: 'input' | 'text';
    inputMode?: InputAttributes['inputMode'];
    renderText?: (formattedValue: string, otherProps: Partial<NumberFormatBase>) => React.ReactNode;
    format?: FormatInputValueFunction;
    removeFormatting?: RemoveFormattingFunction;
    getInputRef?: ((el: HTMLInputElement) => void) | React.Ref<any>;
    value?: number | string | null;
    defaultValue?: number | string | null;
    valueIsNumericString?: boolean;
    onValueChange?: OnValueChange;
    isAllowed?: (values: NumberFormatValues) => boolean;
    onKeyDown?: InputAttributes['onKeyDown'];
    onMouseUp?: InputAttributes['onMouseUp'];
    onChange?: InputAttributes['onChange'];
    onFocus?: InputAttributes['onFocus'];
    onBlur?: InputAttributes['onBlur'];
    getCaretBoundary?: (formattedValue: string) => boolean[];
    isValidInputCharacter?: (character: string) => boolean;
    isCharacterSame?: IsCharacterSame;
};
export declare type NumberFormatBaseProps<BaseType = InputAttributes> = NumberFormatProps<NumberFormatBase, BaseType>;
export declare type InternalNumberFormatBase = Omit<NumberFormatBase, 'format' | 'removeFormatting' | 'getCaretBoundary' | 'isValidInputCharacter' | 'isCharacterSame'>;
export declare type NumericFormatProps<BaseType = InputAttributes> = NumberFormatProps<InternalNumberFormatBase & {
    thousandSeparator?: boolean | string;
    decimalSeparator?: string;
    allowedDecimalSeparators?: Array<string>;
    thousandsGroupStyle?: 'thousand' | 'lakh' | 'wan' | 'none';
    decimalScale?: number;
    fixedDecimalScale?: boolean;
    allowNegative?: boolean;
    allowLeadingZeros?: boolean;
    suffix?: string;
    prefix?: string;
}, BaseType>;
export declare type PatternFormatProps<BaseType = InputAttributes> = NumberFormatProps<InternalNumberFormatBase & {
    format: string;
    mask?: string | string[];
    allowEmptyFormatting?: boolean;
    patternChar?: string;
}, BaseType>;
export {};
