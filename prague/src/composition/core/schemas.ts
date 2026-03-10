type PrimitiveBase = {
  className?: string;
  attrs?: Record<string, string>;
};

export type HeadingPrimitive = PrimitiveBase & {
  type: 'heading';
  level: 1 | 2 | 3 | 4;
  content: string;
};

export type TextPrimitive = PrimitiveBase & {
  type: 'text';
  variant: 'body' | 'caption' | 'label';
  content: string;
};

export type ActionPrimitive = PrimitiveBase & {
  type: 'action';
  variant: 'primary' | 'secondary' | 'ghost';
  content: string;
  href?: string;
  onClick?: string;
};

export type MediaPrimitive = PrimitiveBase & {
  type: 'media';
  variant: 'image' | 'video' | 'widget';
  src?: string;
  alt?: string;
  curatedRef?: string;
};

export type StackPrimitive = PrimitiveBase & {
  type: 'stack';
  direction: 'vertical' | 'horizontal';
  children: Primitive[];
};

export type GridPrimitive = PrimitiveBase & {
  type: 'grid';
  columns: number;
  children: Primitive[];
};

export type Primitive = HeadingPrimitive | TextPrimitive | ActionPrimitive | MediaPrimitive | StackPrimitive | GridPrimitive;

export type SplitLayout = 'visual-left' | 'visual-right' | 'stacked';

export const SPLIT_LAYOUTS: SplitLayout[] = ['visual-left', 'visual-right', 'stacked'];
