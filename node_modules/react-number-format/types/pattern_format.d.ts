import { PatternFormatProps, InputAttributes, ChangeMeta, NumberFormatBaseProps } from './types';
export declare function format<BaseType = InputAttributes>(numStr: string, props: PatternFormatProps<BaseType>): string;
export declare function removeFormatting<BaseType = InputAttributes>(value: string, changeMeta: ChangeMeta, props: PatternFormatProps<BaseType>): string;
export declare function getCaretBoundary<BaseType = InputAttributes>(formattedValue: string, props: PatternFormatProps<BaseType>): boolean[];
export declare function usePatternFormat<BaseType = InputAttributes>(props: PatternFormatProps<BaseType>): NumberFormatBaseProps<BaseType>;
export default function PatternFormat<BaseType = InputAttributes>(props: PatternFormatProps<BaseType>): JSX.Element;
