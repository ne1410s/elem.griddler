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
