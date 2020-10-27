import { Utils } from '../utils';
import { SolveResult } from '../solve/result';

export abstract class XGrid {
  public static AsPlain(
    grid: PlainGrid | DenseGrid | { x: number; y: number } | ImageData
  ): PlainGrid {
    const g = grid as any;
    const retVal =
      grid instanceof ImageData
        ? XGrid.FromImage(grid)
        : g.x && g.y
        ? XGrid.CreatePlain(g.x, g.y)
        : g.c && g.r
        ? XGrid.ToPlain(grid as DenseGrid)
        : g.rows && g.columns
        ? (grid as PlainGrid)
        : null;
    if (retVal == null) {
      throw new RangeError('Unable to interpret as a plain grid.');
    }

    return retVal;
  }

  public static ToDense(plain: PlainGrid): DenseGrid {
    const derive = (ds: PlainDataSet): string => {
      if (!ds.cells || (ds.cells.indexOf(1) === -1 && ds.cells.indexOf(2) === -1)) {
        return '';
      }
      const data = ds.cells
        .reduce(
          (acc, cur, i) => {
            const symbol = cur === 2 ? 'm' : cur === 1 ? 'f' : 'e';
            const isLast = i === ds.cells.length - 1;

            if (!acc.symbol) {
              acc.symbol = symbol;
              acc.count = 0;
            }
            if (acc.symbol === symbol) {
              acc.count++;
            }
            if (acc.count !== 0 && (acc.symbol !== symbol || isLast)) {
              if (acc.symbol !== symbol) {
                acc.items.push(`${acc.symbol}${acc.count === 1 ? '' : acc.count}`);
                acc.count = 1;
                acc.symbol = symbol;
              }
              if (isLast) {
                acc.items.push(`${acc.symbol}${acc.count === 1 ? '' : acc.count}`);
              }
            }

            return acc;
          },
          { symbol: '', count: 0, items: [] as string[] }
        )
        .items.join('');
      return data ? `.${data}` : '';
    };

    return {
      c: plain.columns.map((c) => (c.labels || []).join('.')).join('|'),
      r: plain.rows.map((r) => `${(r.labels || []).join('.')}${derive(r)}`).join('|'),
    };
  }

  public static OverlayResult(ref: ImageData, result: SolveResult) {
    const palette = {
      fill: {
        good: { r: 0, g: 0, b: 0, a: 255 },
        bad: { r: 255, g: 0, b: 0, a: 255 },
      },
      mark: {
        good: { r: 0, g: 0, b: 255, a: 32 },
        bad: { r: 127, g: 0, b: 0, a: 255 },
      },
    };

    const plain = result.solved ? result.grid : result.brokenGrid;
    for (let x = 3; x < ref.data.length; x += 4) {
      const rowNum = Math.floor((x - 3) / 4 / ref.width);
      const colNum = ((x - 3) / 4) % ref.width;
      const state = plain.rows[rowNum].cells[colNum];
      const paletteState =
        state === 1 ? palette.fill : state === 2 && !result.solved ? palette.mark : null;

      if (paletteState) {
        // blocks and (unsolved) marks
        const wasBlock = ref.data[x - 3] === 0 && ref.data[x - 2] === 0 && ref.data[x - 1] === 0;
        const stateRef = (state === 1 && wasBlock) || (state === 2 && !wasBlock) ? 'good' : 'bad';
        const rgba = paletteState[stateRef];
        ref.data[x - 3] = rgba.r;
        ref.data[x - 2] = rgba.g;
        ref.data[x - 1] = rgba.b;
        ref.data[x] = rgba.a;
      }
    }
  }

  public static WipeCells(plain: PlainGrid): void {
    const emptyRow = Utils.FillArray(plain.columns.length, (): 0 => 0);
    plain.rows.forEach((r) => (r.cells = emptyRow.slice()));
  }

  public static WipeLabels(plain: PlainGrid): void {
    plain.rows.forEach((r) => (r.labels = []));
    plain.columns.forEach((c) => (c.labels = []));
  }

  public static ScrapeLabels(plain: PlainGrid): void {
    XGrid.ScrapeColumnLabels(plain);
    const denseRows = XGrid.ToDense(plain).r.split('|');
    denseRows.forEach((row, i) => {
      plain.rows[i].labels = (row.match(/f\d*/g) || []).map((fd) =>
        parseInt(fd.substring(1) || '1')
      );
    });
  }

  private static CreatePlain(columns: number, rows: number): PlainGrid {
    const emptyRow = Utils.FillArray(columns, (): 0 => 0);
    return {
      columns: Utils.FillArray(columns, () => ({ labels: [] })),
      rows: Utils.FillArray(rows, () => ({ labels: [], cells: emptyRow.slice() })),
    };
  }

  private static ToPlain(dense: DenseGrid): PlainGrid {
    const cols = dense.c.split('|');
    const rows = dense.r.split('|');
    const retVal = XGrid.CreatePlain(cols.length, rows.length);

    retVal.columns.forEach((c, i) => {
      const labels = cols[i]
        .split('.')
        .map((l) => parseInt(l))
        .filter((n) => !isNaN(n));
      c.labels = labels.length > 0 ? labels : [];
    });

    retVal.rows.forEach((r, i) => {
      const dataArray = rows[i].split('.');
      const labels = dataArray.map((l) => parseInt(l)).filter((n) => !isNaN(n));
      r.labels = labels.length > 0 ? labels : [];
      if (labels.length === 0 || dataArray.length === labels.length + 1) {
        r.cells = dataArray
          .pop()
          .split(/(?=[mfe]\d*)/)
          .reduce((acc, cur) => {
            const numero = cur[0] === 'm' ? 2 : cur[0] === 'f' ? 1 : 0;
            const freq = cur ? parseInt(cur.substring(1)) || 1 : cols.length;
            acc = acc.concat(Utils.FillArray(freq, () => numero));
            return acc;
          }, []);
      }
    });

    return retVal;
  }

  private static FromImage(img: ImageData): PlainGrid {
    const retVal = XGrid.CreatePlain(img.width, img.height);
    for (let x = 3; x < img.data.length; x += 4) {
      const rowNum = Math.floor((x - 3) / 4 / img.width);
      const colNum = ((x - 3) / 4) % img.width;
      const isBlock = img.data[x - 3] === 0 && img.data[x - 2] === 0 && img.data[x - 1] === 0;
      if (isBlock) retVal.rows[rowNum].cells[colNum] = 1;
    }

    return retVal;
  }

  /** Scrapes column labels from cell state */
  private static ScrapeColumnLabels(plain: PlainGrid): void {
    plain.columns.forEach((col, c) => {
      col.labels = [];
      let run = 0;
      for (let r = 0; r < plain.rows.length; r++) {
        const isBlock = plain.rows[r].cells[c] === 1;
        if (isBlock) run++;
        if (run > 0 && (!isBlock || r === plain.rows.length - 1)) {
          col.labels.push(run);
          run = 0;
        }
      }
    });
  }
}

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

export interface DenseGrid {
  c: string;
  r: string;
}
