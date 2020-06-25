import { SetType, CellState } from './enums';
import { FullSet } from './full-set';
import { Label } from './label';
import { HintResult, SolveResult } from './result';
import { Utils } from '../utils';
import { PlainGrid, PlainSet, PlainDataSet } from '../models/grid';

/** A griddler grid. */
export class Grid {
  public static load(gridObject: PlainGrid): Grid {
    const grid = new Grid(gridObject.columns.length, gridObject.rows.length);
    gridObject.columns.forEach((col: PlainSet, colIdx: number) => {
      grid.setLabels(SetType.Column, colIdx, col.labels);
    });

    gridObject.rows.forEach((row: PlainDataSet, rowIdx: number) => {
      grid.setLabels(SetType.Row, rowIdx, row.labels);
      (row.cells || [])
        .map((cell: 0 | 1 | 2, cellIdx: number) => ({ oState: cell, idx: cellIdx }))
        .filter((obj) => obj.oState !== 0)
        .forEach((obj) => {
          const state = obj.oState === 1 ? CellState.Filled : CellState.Marked;
          grid.setState(SetType.Row, rowIdx, obj.idx, state);
        });
    });
    return grid;
  }

  public width: number;
  public height: number;
  private _cellCache: CellState[][];
  private _rowLabelCache: number[][];
  private _columnLabelCache: number[][];

  public get consoleRef(): string {
    return this._rowLabelCache.map((n, r) => this.getFullSet(SetType.Row, r).stateRef).join('\r\n');
  }

  public get unsolvedCellCount(): number {
    return this._cellCache
      .reduce((ac, cur) => ac.concat(cur), [])
      .filter((state) => state === CellState.Blank).length;
  }

  public get solved(): boolean {
    return !this._cellCache
      .reduce((ac, cur) => ac.concat(cur), [])
      .some((state) => state === CellState.Blank);
  }

  public get gridObject(): PlainGrid {
    return {
      columns: this._columnLabelCache.map((n, c) => ({
        labels: this.getLabels(SetType.Column, c),
      })),
      rows: this._rowLabelCache.map((n, r) => {
        return {
          labels: this.getLabels(SetType.Row, r),
          cells: this.getFullSet(SetType.Row, r).cells.map((c) =>
            c === CellState.Marked ? 2 : CellState.Filled ? 1 : 0
          ),
        };
      }),
    };
  }

  private constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this._rowLabelCache = Utils.FillArray(this.height, () => []);
    this._columnLabelCache = Utils.FillArray(this.width, () => []);
    this._cellCache = this._columnLabelCache.map(() =>
      Utils.FillArray(this.height, () => CellState.Blank)
    );
  }

  public nextHint(): HintResult {
    const allCols = Utils.FillArray(this.width, () => 0).map((x, i) => i);
    const allRows = Utils.FillArray(this.height, () => 0).map((x, i) => i);
    const colsrows = this.solveSetsRecursively([allCols, allRows], true);
    let result: HintResult = null;
    if (colsrows) {
      const pass = colsrows[263 % colsrows.length];
      result = { type: SetType[pass.type], idx: pass.idx };
    }

    return result;
  }

  public solve(): SolveResult {
    const t0 = new Date().getTime();
    const allCols = Utils.FillArray(this.width, () => 0).map((x, i) => i);
    const allRows = Utils.FillArray(this.height, () => 0).map((x, i) => i);
    this.solveSetsRecursively([allCols, allRows]);
    const t1 = new Date().getTime();
    return new SolveResult(this.gridObject, this.solved, t1 - t0);
  }

  public setState(setType: SetType, setIndex: number, cellIndex: number, state: CellState): void {
    if (setType === SetType.Row) {
      this._cellCache[cellIndex][setIndex] = state;
    } else {
      this._cellCache[setIndex][cellIndex] = state;
    }
  }

  public setLabels(type: SetType, index: number, values: number[]): void {
    const setRef = `${SetType[type].substr(0, 3)} ${index}`;
    const target = type === SetType.Row ? this._rowLabelCache : this._columnLabelCache;

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
    const cells =
      type === SetType.Row ? this._cellCache.map((val) => val[index]) : this._cellCache[index];
    return new FullSet(0, type, index, cells, this.getLabels(type, index));
  }

  public getLabels(type: SetType, index: number): number[] {
    return type === SetType.Row ? this._rowLabelCache[index] : this._columnLabelCache[index];
  }

  private solveSetsRecursively(colsrows: [number[], number[]], shallow: boolean = false) {
    const allUnsolvedHintworthy = colsrows[0]
      .map((c) => this.getFullSet(SetType.Column, c))
      .concat(colsrows[1].map((r) => this.getFullSet(SetType.Row, r)))
      .filter((set) => !set.solved)
      .map((us) => {
        const cr = us.solve();
        cr.marks.forEach((m) => this.setState(us.type, us.index, m, CellState.Marked));
        cr.fills.forEach((f) => this.setState(us.type, us.index, f, CellState.Filled));
        return {
          type: us.type,
          idx: us.index, // for hints
          crType: us.altType,
          crIdx: cr.marks.concat(cr.fills), // for solving
        };
      })
      .filter((obj) => obj.crIdx.length !== 0);

    if (shallow) {
      return allUnsolvedHintworthy;
    }

    const allUnsolved = allUnsolvedHintworthy
      .reduce(
        (ac, obj) => {
          ac[obj.crType].push(...obj.crIdx);
          return ac;
        },
        [[], []] as [number[], number[]]
      )
      .map((arr) =>
        arr.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).filter((n, i, x) => !i || n !== x[i - 1])
      );

    if (allUnsolved[0].length + allUnsolved[1].length !== 0) {
      this.solveSetsRecursively([allUnsolved[0], allUnsolved[1]]);
    }

    return null;
  }
}
