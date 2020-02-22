import { SetType, Label, CellState, HintResult, SolveResult, Utils } from "./models";
import { FullSet } from "./full-set";

/** A griddler grid. */
export class Grid {

  public static load(gridObject: any): Grid {
    const grid = new Grid();
    grid.init(gridObject.columns.length, gridObject.rows.length);
    gridObject.columns.forEach((col: any, colIdx: number) => {
      grid.setLabels(SetType.Column, colIdx, col.labels);
    });

    gridObject.rows.forEach((row: any, rowIdx: number) => {
      grid.setLabels(SetType.Row, rowIdx, row.labels);
      (row.cells || [])
        .map((cell: any, cellIdx: number) => ({ oState: cell, idx: cellIdx }))
        .filter((obj: any) => obj.oState !== 0)
        .forEach((obj: any) => {
          const state = obj.oState === 1 ? CellState.Filled : CellState.Marked;
          grid.setState(SetType.Row, rowIdx, obj.idx, state);
        });
    });
    return grid;
  }

  /** Convenience method for solving an object in a single line. */
  public static solve(gridObject: any): SolveResult {
    return Grid.load(gridObject).solve();
  }

  /** Convenience method for hinting an object in a single line. */
  public static hint(gridObject: any): HintResult {
    return Grid.load(gridObject).hint();
  }

  public width: number;
  public height: number;
  private _cellCache: CellState[][];
  private _rowLabelCache: number[][];
  private _columnLabelCache: number[][];

  public get consoleRef(): string {
    return this._rowLabelCache
      .map((n, r) => this.getFullSet(SetType.Row, r).stateRef)
      .join('\r\n');
  }

  public get unsolvedCellCount(): number {
    return this._cellCache
      .reduce((ac, cur) => ac.concat(cur), [])
      .filter(state => state === CellState.Blank).length;
  }

  public get solved(): boolean {
    return !this._cellCache
      .reduce((ac, cur) => ac.concat(cur), [])
      .some(state => state === CellState.Blank);
  }

  public get gridObject(): any {
    return {
      columns: this._columnLabelCache.map((n, c) => ({ labels: this.getLabels(SetType.Column, c) })),
      rows: this._rowLabelCache.map((n, r) => {
        return {
          labels: this.getLabels(SetType.Row, r),
          cells: this.getFullSet(SetType.Row, r).cells
            .map(c => c === CellState.Marked ? 2 : CellState.Filled ? 1 : 0),
        };
      }),
    };
  }

  public init(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this._rowLabelCache = Utils.fillArray(this.height, () => []);
    this._columnLabelCache = Utils.fillArray(this.width, () => []);
    this._cellCache = this._columnLabelCache
      .map(n => Utils.fillArray(this.height, () => CellState.Blank));
  }

  public hint(): HintResult {
    const allCols = Utils.fillArray(this.width, () => 0).map((x, i) => i);
    const allRows = Utils.fillArray(this.height, () => 0).map((x, i) => i);
    const colsrows = this.solveSetsRecursively([allCols, allRows], true);
    return new HintResult(colsrows);
  }

  public solve(): SolveResult {
    const t0 = new Date().getTime();
    const allCols = Utils.fillArray(this.width, () => 0).map((x, i) => i);
    const allRows = Utils.fillArray(this.height, () => 0).map((x, i) => i);
    this.solveSetsRecursively([allCols, allRows]);
    const t1 = new Date().getTime();
    return new SolveResult(this.gridObject, this.solved, t1 - t0);
  }

  public setState(setType: SetType, setIndex: number, cellIndex: number, state: CellState): void {
    if (setType === SetType.Row) { this._cellCache[cellIndex][setIndex] = state; }
    else { this._cellCache[setIndex][cellIndex] = state; }
  }

  public setLabels(type: SetType, index: number, values: number[]): void {
    const setRef = `${SetType[type].substr(0, 3)} ${index}`;
    const target = type === SetType.Row
      ? this._rowLabelCache
      : this._columnLabelCache;

    if (target[index] == null) {
      const msg = 'Not found';
      throw new RangeError(`${setRef}: ${msg}`);
    }

    const setSize = type === SetType.Row ? this.width : this.height;
    const minSize = Label.minSize(values);

    if (minSize > setSize) {
      const msg = `The minimum total label size (${minSize}) exceeds the set length (${setSize})`;
      throw new RangeError(`${setRef}: ${msg}`);
    }

    target[index] = values;
  }

  public getFullSet(type: SetType, index: number): FullSet {
    const cells = type === SetType.Row
      ? this._cellCache.map((val) => val[index])
      : this._cellCache[index];
    return new FullSet(0, type, index, cells, this.getLabels(type, index));
  }

  public getLabels(type: SetType, index: number): number[] {
    return type === SetType.Row
      ? this._rowLabelCache[index]
      : this._columnLabelCache[index];
  }

  private solveSetsRecursively(colsrows: [number[], number[]], shallow: boolean = false): any {
    const allUnsolvedHintworthy = colsrows[0]
      .map(c => this.getFullSet(SetType.Column, c))
      .concat(colsrows[1].map(r => this.getFullSet(SetType.Row, r)))
      .filter(set => !set.solved)
      .map(us => {
        const cr = us.solve();
        cr.marks.forEach(m => this.setState(us.type, us.index, m, CellState.Marked));
        cr.fills.forEach(f => this.setState(us.type, us.index, f, CellState.Filled));
        return { crIdx: cr.marks.concat(cr.fills), crType: us.altType };
      })
      .filter(obj => obj.crIdx.length !== 0);

    if (shallow) {
      return allUnsolvedHintworthy;
    }

    const allUnsolved = allUnsolvedHintworthy
      .reduce((ac, obj) => {
        ac[obj.crType].push(...obj.crIdx);
        return ac;
      }, [[], []] as [number[], number[]])
      .map(arr => arr.sort((a, b) => a < b ? -1 : a > b ? 1 : 0).filter((n, i, x) => !i || n !== x[i - 1]));

    if (allUnsolved[0].length + allUnsolved[1].length !== 0) {
      this.solveSetsRecursively([allUnsolved[0], allUnsolved[1]]);
    }

    return null;
  }
}