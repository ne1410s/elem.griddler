export interface GridEditHistory {
  date: Date;
  type: string;
  grid: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface GridContextPoint extends Point {
  x0: number;
  y0: number;
  which: 'left' | 'right';
  state: 0 | 1 | 2;
  snapshot: string;
  pending?: boolean;
}
