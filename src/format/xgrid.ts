import { DenseGrid } from "./dense-grid";
import { PlainGrid, PlainDataSet } from "./plain-grid";
import { Utils } from "./utils";

export abstract class XGrid {

  public static AsPlain(grid: PlainGrid | DenseGrid | { x: number, y: number }): PlainGrid {
    const g = grid as any;
    const retVal = g.x && g.y ? XGrid.CreatePlain(g.x, g.y)
      : g.c && g.r ? XGrid.ToPlain(grid as DenseGrid)
      : g.rows && g.columns ? grid as PlainGrid
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
      const data = ds.cells.reduce((acc, cur, i) => {
        const symbol = cur === 2 ? 'm' : cur === 1 ? 'f' : 'e';
        if (!acc.symbol) { acc.symbol = symbol };
        if (acc.symbol === symbol) { acc.count++; }
        if (acc.count !== 0 && (acc.symbol !== symbol || i === plain.rows.length - 1)) {
          acc.items.push(`${acc.symbol}${acc.count === 1 ? '' : acc.count}`);
          acc.symbol = symbol;
          acc.count = 1;
        }
        return acc;
      }, { symbol: '', count: 0, items: [] as string[] }).items.join('');
      return data ? `.${data}` : '';
    };

    return {
      c: plain.columns.map(c => (c.labels || []).join('.')).join('|'),
      r: plain.rows.map(r => `${(r.labels || []).join('.')}${derive(r)}`).join('|'),
    };
  }

  public static WipeCells(plain: PlainGrid): void {
    const emptyRow = Utils.fillArray(plain.columns.length, (): 0 => 0);
    plain.rows.forEach(r => r.cells = emptyRow.slice());
  }
  
  private static CreatePlain(columns: number, rows: number): PlainGrid {
    const emptyRow = Utils.fillArray(columns, (): 0 => 0);
    return {
      columns: Utils.fillArray(columns, () => ({ labels: [] })),
      rows: Utils.fillArray(rows, () => ({ labels: [], cells: emptyRow.slice() }))
    };
  }

  private static ToPlain(dense: DenseGrid): PlainGrid {
    const cols = dense.c.split('|');
    const rows = dense.r.split('|');
    const retVal = XGrid.CreatePlain(cols.length, rows.length);

    retVal.columns.forEach((c, i) => {
      const labels = cols[i].split('.').map(l => parseInt(l)).filter(n => !isNaN(n));
      c.labels = labels.length > 0 ? labels : [];
    });

    retVal.rows.forEach((r, i) => {
      const dataArray = rows[i].split('.');
      const labels = dataArray.map(l => parseInt(l)).filter(n => !isNaN(n));
      r.labels = labels.length > 0 ? labels : [];
      if (dataArray.length === 1 + labels.length) {
        r.cells = dataArray.pop().split(/(?=[mfe]\d*)/).reduce((acc, cur) => {
          const numero = cur[0] === 'm' ? 2 : cur[0] === 'f' ? 1 : 0;
          const freq = parseInt(cur.substring(1)) || 1;
          acc = acc.concat(Utils.fillArray(freq, () => numero));
          return acc;
        }, []);
      }
    });

    return retVal;
  }
}