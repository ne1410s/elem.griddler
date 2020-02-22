/** The state of a cell. Values are unicode representations of the state. */
export enum CellState { Blank = 0x25FB, Marked = 0x25A3, Filled = 0x25FC }

/** The type of a set of cells. */
export enum SetType { Column, Row }