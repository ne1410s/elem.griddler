import { PlainGrid } from '../models/grid';

/** The outcome of running a 'solve' grid method. */
export class SolveResult {

  public readonly grid: PlainGrid;
  public readonly brokenGrid: PlainGrid;

  constructor(
    gridObject: PlainGrid,
    public readonly solved: boolean,
    public readonly solvedMs: number) {

    if (solved) { this.grid = gridObject; }
    else { this.brokenGrid = gridObject; }
  }
}

export interface HintResult {
  type: string;
  idx: number;
}
