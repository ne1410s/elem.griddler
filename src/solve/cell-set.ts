import { SetType } from './enums';

/** A contiguous set of cells. */
export abstract class CellSetBase {
  public readonly end: number;

  constructor(
    public readonly start: number,
    public readonly type: SetType,
    public readonly index: number,
    public readonly size: number
  ) {
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
    public readonly spaceIndex: number
  ) {
    super(start, type, index, size);
  }
}

/** A set of unmarked cells. */
export class SpaceSet extends CellSetBase {}
