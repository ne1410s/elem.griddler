/** A contiguous set of cells. */
export abstract class CellSetBase {

  public readonly end: number;

  constructor(
    public readonly start: number,
    public readonly type: SetType,
    public readonly index: number,
    public readonly size: number) {

    this.end = this.start + this.size - 1;
  }
}

/** A set of consecutive 'filled' cells. */
export class BlockSet extends CellSetBase {
  public rightEdge: number;
  public leftEdge: number;
  public minSize: number;
  public maxSize: number;
  constructor(
    public readonly start: number,
    public readonly type: SetType,
    public readonly index: number,
    public readonly size: number,
    public readonly spaceIndex: number) {
    super(start, type, index, size);
  }
}

/** A set of unmarked cells. */
export class SpaceSet extends CellSetBase { }


/** The outcome of running a 'solve' grid method. */
export class SolveResult {

  public readonly grid: any;
  public readonly brokenGrid: any;

  constructor(
    gridObject: any,
    public readonly solved: boolean,
    public readonly solvedMs: number) {

    if (solved) { this.grid = gridObject; }
    else { this.brokenGrid = gridObject; }
  }
}

export class HintResult {
  constructor(
    public readonly test: any) { }
}

/** The state of a cell. Values are unicode representations of the state. */
export enum CellState { Blank = 0x25FB, Marked = 0x25A3, Filled = 0x25FC }

/** The type of a set of cells. */
export enum SetType { Column, Row }

export class LabelSetLink {
  constructor(
    public readonly labelIndex: number,
    public readonly setIndex: number,
    public known: boolean) { }
}

export class Label {

  /** Gets the minimum total size for a set of separated values. */
  public static minSize(values: number[]): number {
    return values.reduce((tot, curr) => {
      return tot > 0 ? curr + tot + 1 : curr + tot;
    }, 0);
  }

  public earliest: number;
  public latest: number;
  public readonly indexRef: string;

  constructor(
    public readonly value: number,
    public readonly index: number) {
    this.indexRef = `L${this.index}`;
  }
}

export class Utils {

  /** Returns a new array of the specified size filled with the specified value. */
  public static fillArray(size: number, valuer: () => any): any[] {
    const retVal = new Array(size);
    for (let i = 0; i < size; i++) { retVal[i] = valuer(); }
    return retVal;
  }
}