export interface PlainGrid {
  columns: PlainSet[];
  rows: PlainDataSet[];
}

export interface PlainSet {
  labels?: number[];
}

export interface PlainDataSet extends PlainSet {
  cells?: (0 | 1 | 2)[];
}