import { NumberFormatBaseProps, FormatInputValueFunction, OnValueChange, IsCharacterSame } from './types';
export declare function noop(): void;
export declare function returnTrue(): boolean;
export declare function memoizeOnce<T extends unknown[], R extends unknown>(cb: (...args: T) => R): (...args: T) => R;
export declare function charIsNumber(char?: string): boolean;
export declare function isNil(val: any): val is null | undefined;
export declare function isNanValue(val: string | number): boolean;
export declare function isNotValidValue(val: string | number | null | undefined): boolean;
export declare function escapeRegExp(str: string): string;
export declare function getThousandsGroupRegex(thousandsGroupStyle: string): RegExp;
export declare function applyThousandSeparator(str: string, thousandSeparator: string, thousandsGroupStyle: string): string;
export declare function usePersistentCallback<T extends (...args: any[]) => any>(cb: T): T;
export declare function splitDecimal(numStr: string, allowNegative?: boolean): {
    beforeDecimal: string;
    afterDecimal: string;
    hasNegation: boolean;
    addNegation: boolean;
};
export declare function fixLeadingZero(numStr?: string): string;
/**
 * limit decimal numbers to given scale
 * Not used .fixedTo because that will break with big numbers
 */
export declare function limitToScale(numStr: string, scale: number, fixedDecimalScale: boolean): string;
export declare function toNumericString(num: string | number): string;
/**
 * This method is required to round prop value to given scale.
 * Not used .round or .fixedTo because that will break with big numbers
 */
export declare function roundToPrecision(numStr: string, scale: number, fixedDecimalScale: boolean): string;
/** set the caret positon in an input field **/
export declare function setCaretPosition(el: HTMLInputElement, caretPos: number): boolean;
/**
 * TODO: remove dependency of findChangeRange, findChangedRangeFromCaretPositions is better way to find what is changed
 * currently this is mostly required by test and isCharacterSame util
 * Given previous value and newValue it returns the index
 * start - end to which values have changed.
 * This function makes assumption about only consecutive
 * characters are changed which is correct assumption for caret input.
 */
export declare const findChangeRange: (prevValue: string, newValue: string) => {
    from: {
        start: number;
        end: number;
    };
    to: {
        start: number;
        end: number;
    };
};
export declare const findChangedRangeFromCaretPositions: (lastCaretPositions: {
    selectionStart: number;
    selectionEnd: number;
}, currentCaretPosition: number) => {
    from: {
        start: number;
        end: number;
    };
    to: {
        start: number;
        end: number;
    };
};
export declare function clamp(num: number, min: number, max: number): number;
export declare function geInputCaretPosition(el: HTMLInputElement): number;
export declare function addInputMode(): boolean;
export declare function getDefaultChangeMeta(value: string): {
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
export declare function getMaskAtIndex(mask: string | string[], index: number): string;
export declare function getCaretPosition(newFormattedValue: string, lastFormattedValue: string, curValue: string, curCaretPos: number, boundary: boolean[], isValidInputCharacter: (char: string) => boolean, 
/**
 * format function can change the character, the caret engine relies on mapping old value and new value
 * In such case if character is changed, parent can tell which chars are equivalent
 * Some example, all allowedDecimalCharacters are updated to decimalCharacters, 2nd case if user is coverting
 * number to different numeric system.
 */
isCharacterSame?: IsCharacterSame): any;
export declare function getCaretPosInBoundary(value: string, caretPos: number, boundary: boolean[], direction?: string): number;
export declare function caretUnknownFormatBoundary(formattedValue: string): boolean[];
export declare function useInternalValues(value: string | number | null | undefined, defaultValue: string | number | null | undefined, valueIsNumericString: boolean, format: FormatInputValueFunction, removeFormatting: NumberFormatBaseProps['removeFormatting'], onValueChange?: NumberFormatBaseProps['onValueChange']): [{
    formattedValue: string;
    numAsString: string;
}, OnValueChange];
