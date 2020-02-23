export interface PortableGrid {
  columns: PortableSet[];
  rows: PortableDataSet[];
}

export interface PortableSet {
  labels: number[];
}

export interface PortableDataSet extends PortableSet {
  cells: (0 | 1 | 2)[];
}