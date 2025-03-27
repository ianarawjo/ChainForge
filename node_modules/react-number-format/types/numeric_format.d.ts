import { NumericFormatProps, ChangeMeta, InputAttributes, NumberFormatBaseProps } from './types';
export declare function format<BaseType = InputAttributes>(numStr: string, props: NumericFormatProps<BaseType>): string;
export declare function removeFormatting<BaseType = InputAttributes>(value: string, changeMeta: ChangeMeta, props: NumericFormatProps<BaseType>): string;
export declare function getCaretBoundary<BaseType = InputAttributes>(formattedValue: string, props: NumericFormatProps<BaseType>): boolean[];
export declare function useNumericFormat<BaseType = InputAttributes>(props: NumericFormatProps<BaseType>): NumberFormatBaseProps<BaseType>;
export default function NumericFormat<BaseType = InputAttributes>(props: NumericFormatProps<BaseType>): JSX.Element;
