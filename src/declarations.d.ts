declare module 'react-grid-layout/legacy' {
  import React, { ComponentType } from 'react';

  export interface LayoutItem {
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
    minW?: number;
    maxW?: number;
    minH?: number;
    maxH?: number;
    static?: boolean;
    isDraggable?: boolean;
    isResizable?: boolean;
  }

  export type Layout = LayoutItem[];

  export interface ReactGridLayoutProps {
    layout?: LayoutItem[];
    cols?: number;
    rowHeight?: number;
    width?: number;
    margin?: [number, number];
    containerPadding?: [number, number] | null;
    onLayoutChange?: (layout: LayoutItem[]) => void;
    draggableHandle?: string;
    compactType?: 'vertical' | 'horizontal' | null;
    isDraggable?: boolean;
    isResizable?: boolean;
    children?: React.ReactNode;
    [key: string]: any;
  }

  export class ReactGridLayout extends React.Component<ReactGridLayoutProps> {}

  export function WidthProvider<P extends object>(
    ComposedComponent: ComponentType<P>
  ): ComponentType<Omit<P, 'width'>>;
}
