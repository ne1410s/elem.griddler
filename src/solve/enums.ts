/** The state of a cell. Values are unicode representations of the state. */
export enum CellState {
  Blank = 0x25fb,
  Marked = 0x25a3,
  Filled = 0x25fc,
}

/** The type of a set of cells. */
export enum SetType {
  Column,
  Row,
}
