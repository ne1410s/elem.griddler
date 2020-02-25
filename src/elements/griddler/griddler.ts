import { CustomElementBase } from '@ne1410s/cust-elems';
import { PlainGrid } from '../../format/plain-grid';
import { Grid } from '../../solve/grid';
import { XGrid } from '../../format/xgrid';
import { DenseGrid } from '../../format/dense-grid';
import markupUrl from './griddler.html';
import stylesUrl from './griddler.css';

export class Griddler extends CustomElementBase {

  public static observedAttributes = ['cols', 'rows', 'size'];

  private static readonly XY_MIN = 5;
  private static readonly XY_MAX = 1000;
  private static readonly XY_INTERVAL = 5;
  private static readonly XY_DEF = 5;
  private static readonly RESOLUTION = 2;
  private static readonly MINOR_COL = '#eee';
  private static readonly MAJOR_COL = '#555';
  private static readonly HIGHLIGHT = 'rgba(0, 0, 200, 0.4)';

  private static readonly SIZE_MIN = 5 * Griddler.RESOLUTION;
  private static readonly SIZE_MAX = 50 * Griddler.RESOLUTION;
  private static readonly SIZE_INTERVAL = 1 * Griddler.RESOLUTION;
  private static readonly SIZE_DEF = 20 * Griddler.RESOLUTION;
  private static readonly PIXEL_ADJUST = .5 * Griddler.RESOLUTION;
  
  private readonly _gridCanvas: HTMLCanvasElement;
  private readonly _hiCanvas: HTMLCanvasElement;
  private readonly _hiContext: CanvasRenderingContext2D;

  private _size = Griddler.SIZE_DEF;
  private _grid = XGrid.AsPlain({ x: Griddler.XY_DEF, y: Griddler.XY_DEF });
  private _downCoords: GridContextPoint;

  get totalColumns(): number { return this._grid.columns.length; }
  get totalRows(): number { return this._grid.rows.length; }

  get totalWidth(): number { return this._gridCanvas.width; }
  set totalWidth(value: number) {
    this._gridCanvas.width = value;
    this._hiCanvas.width = value;
  }

  get totalHeight(): number { return this._gridCanvas.height; }
  set totalHeight(value: number) {
    this._gridCanvas.height = value;
    this._hiCanvas.height = value;
  }

  constructor() {

    super(stylesUrl, markupUrl);
    this._gridCanvas = this.root.querySelector('canvas#grid');
    this._hiCanvas = this.root.querySelector('canvas#hilite');
    this._hiContext = this._hiCanvas.getContext('2d');
    this._hiContext.imageSmoothingEnabled = false;

    this._gridCanvas.addEventListener('mouseleave', () => { 
      if (!this._downCoords) this.clearContext(this._hiContext);
    });
    this._gridCanvas.addEventListener('mousemove', (e: MouseEvent) => {
      const moveCoords = this.getCoords(e);
      
      // If not left-button-initiated (or else moving on initial-cell)
      if (this._downCoords?.which !== 1 || (this._downCoords.x === moveCoords.x && this._downCoords.y === moveCoords.y)) {
        this.highlight(moveCoords);
      }
      
      // If ripe for the paintin'
      if (this._downCoords?.x === moveCoords.x || this._downCoords?.y === moveCoords.y) {
        
        // Left button drag on empty cells:
        if (moveCoords.state === 0 && this._downCoords.which === 1) {
          this.setState(moveCoords, 1);
        }
      }
    });
    this._gridCanvas.addEventListener('mousedown', event => {
      this._downCoords = this.getCoords(event);
    });
    this._gridCanvas.addEventListener('mouseup', event => {
      event.stopImmediatePropagation();
      if (this._downCoords) {
        const upCoords = this.getCoords(event);
        if (upCoords.x === this._downCoords.x && upCoords.y === this._downCoords.y) {
          switch (this._downCoords.which) {
            case 1:
              const next = (this._downCoords.state + 1) % 3;
              this.setState(this._downCoords, next as 0 | 1 | 2);
              break;
            case 3:
              /* right-click */
              break;
          }
        }

        this._downCoords = null;
      }
    });
    window.addEventListener('mouseup', (event: any) => {
      this._downCoords = null;
      this.clearContext(this._hiContext);
    });

    this.root.querySelector('#btnSolve').addEventListener('click', () => this.solve());
    this.root.querySelector('#btnClear').addEventListener('click', () => this.clear());
    this.root.querySelector('#btnExport').addEventListener('click', () => this.export());
  }

  /**
   * Draws a grid according to the grid data supplied.
   * @param grid The grid data.
   */
  load(grid: PlainGrid | DenseGrid | { x: number, y: number }) {
    this._grid = XGrid.AsPlain(grid);
    this.refresh();
  }

  /** Removes all cell data, leaving the labels intact. */
  clear() {
    XGrid.WipeCells(this._grid);
    this.refresh();
  }

  /** Attempts to solve the grid. */
  solve() {
    const result = Grid.load(this._grid).solve();
    if (result.solved) {
      console.log('Solved in ' + result.solvedMs + 'ms');
      this.load(result.grid);
    }
  }

  /** Exports the grid in a condensed format. */
  export() {
    console.log(XGrid.ToDense(this._grid));
  }

  /**
   * Redraws the entire grid in accordance with the current state.
   */
  refresh() {
    const grid_w = this.totalColumns * this._size + Griddler.PIXEL_ADJUST;
    const grid_h = this.totalRows * this._size + Griddler.PIXEL_ADJUST;
    const labels_w = grid_w * 2 / 5;
    const labels_h = grid_h * 2 / 5;

    this.totalWidth = grid_w + labels_w;
    this.totalHeight = grid_h + labels_h;
    const client_w = this.totalWidth / Griddler.RESOLUTION;
    this.root.querySelector('.root').setAttribute('style', `width: ${client_w}px`);

    const gridContext = this._gridCanvas.getContext('2d');
    this.clearContext(gridContext);
    gridContext.imageSmoothingEnabled = false;
    gridContext.beginPath();
    for (let c = 0; c <= this.totalColumns; c++) {
      gridContext.moveTo(c * this._size + Griddler.PIXEL_ADJUST, 0);
      gridContext.lineTo(c * this._size + Griddler.PIXEL_ADJUST, grid_h);
    }
    for (let r = 0; r <= this.totalRows; r++) {
      gridContext.moveTo(0, r * this._size + Griddler.PIXEL_ADJUST);
      gridContext.lineTo(grid_w, r * this._size + Griddler.PIXEL_ADJUST);
    }
    gridContext.strokeStyle = Griddler.MINOR_COL;
    gridContext.lineWidth = Griddler.RESOLUTION;
    gridContext.stroke();    
    gridContext.closePath();

    gridContext.beginPath();
    for (let c = 0; c <= this.totalColumns; c += Griddler.XY_INTERVAL) {
      gridContext.moveTo(c * this._size + Griddler.PIXEL_ADJUST, 0);
      gridContext.lineTo(c * this._size + Griddler.PIXEL_ADJUST, grid_h);
    }
    for (let r = 0; r <= this.totalRows; r += Griddler.XY_INTERVAL) {
      gridContext.moveTo(0, r * this._size + Griddler.PIXEL_ADJUST);
      gridContext.lineTo(grid_w, r * this._size + Griddler.PIXEL_ADJUST);
    }
    gridContext.strokeStyle = Griddler.MAJOR_COL;
    gridContext.lineWidth = Griddler.RESOLUTION;
    gridContext.stroke();    
    gridContext.closePath();

    this._hiContext.fillStyle = Griddler.HIGHLIGHT;
    
    this.populate(gridContext);
  }

  connectedCallback() {
    this.refresh();
  }
  
  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    switch (name) {
      case 'cols':
        const totalColumns = Griddler.Round(
          newValue,
          Griddler.XY_DEF,
          Griddler.XY_INTERVAL,
          Griddler.XY_MIN,
          Griddler.XY_MAX);
        this.load(XGrid.AsPlain({ x: totalColumns, y: this.totalRows }));
        break;
      case 'rows':
        const totalRows = Griddler.Round(
          newValue,
          Griddler.XY_DEF,
          Griddler.XY_INTERVAL,
          Griddler.XY_MIN,
          Griddler.XY_MAX);
        this.load(XGrid.AsPlain({ x: this.totalColumns, y: totalRows }));
        break;
      case 'size':
        this._size = Griddler.Round(
          newValue,
          Griddler.SIZE_DEF,
          Griddler.SIZE_INTERVAL,
          Griddler.SIZE_MIN,
          Griddler.SIZE_MAX);
        break;
    }
  }

  private static Round(val: string|number, def: number, to: number, min: number, max: number) {
    val = parseInt(`${val}`)
    const rnd = to * Math.round((isNaN(val) ? def : val) / to);
    return Math.max(min, Math.min(max, rnd));
  }

  private getState(point: Point): 0 | 1 | 2 { 
    return !point.x || !point.y ? null
      : this._grid.rows[point.y - 1].cells[point.x - 1];
  }

  private setState(point: GridContextPoint, state: 0 | 1 | 2): void {
    if (point.x && point.y) {
      const ci = point.x - 1, ri = point.y - 1;
      const celRef = this._grid.rows[ri].cells;
      if (celRef[ci] !== state) {
        celRef[ci] = state;
        point.ctx.beginPath();
        this.setCell(point.ctx, ci, ri, false);
        switch (state) {
          case 1: this.setCell(point.ctx, ci, ri, true); break;
          case 2: this.markCell(point.ctx, ci, ri); break;
        }
        point.ctx.fill();
      }
    }
  }

  private markCell(ctx: CanvasRenderingContext2D, ci: number, ri: number) {
    const x0 = ci * this._size + Griddler.PIXEL_ADJUST + (this._size / 2);
    const y0 = ri * this._size + Griddler.PIXEL_ADJUST + (this._size / 2);
    ctx.moveTo(x0, y0);
    ctx.arc(x0, y0, this._size / 8, 0, 2 * Math.PI);
  }

  private setCell(ctx: CanvasRenderingContext2D, ci: number, ri: number, doFill: boolean) {
    const buffer = 2 * Griddler.PIXEL_ADJUST;
    const method = doFill ? 'rect' : 'clearRect';
    ctx[method](
      ci * this._size + buffer,
      ri * this._size + buffer,
      this._size - buffer,
      this._size - buffer);
  }

  private populate(gridContext: CanvasRenderingContext2D) {

    // cell states
    gridContext.beginPath();
    this._grid.rows
      .map((row, idx) => ({ cells: row.cells, idx }))
      .forEach(row => (row.cells || [])
        .map((state, idx) => ({ state, idx }))
        .forEach(cell => {
          switch (cell.state) {
            case 1: this.setCell(gridContext, cell.idx, row.idx, true); break;
            case 2: this.markCell(gridContext, cell.idx, row.idx); break;
          }
        })
      );
    gridContext.fill();

    // labels
    const grid_w = this.totalColumns * this._size + Griddler.PIXEL_ADJUST;
    const grid_h = this.totalRows * this._size + Griddler.PIXEL_ADJUST;
    const font_size = this._size * .55;
    gridContext.font = `${font_size}px Times New Roman`;

    gridContext.textAlign = 'left';
    this._grid.rows
      .map((row, idx) => ({ labels: row.labels, idx }))
      .filter(set => set.labels && set.labels.length > 0)
      .forEach(set => {
        const x = grid_w + (font_size / 2);
        const y = set.idx * this._size + (this._size / 2) + (font_size / 2);
        gridContext.fillText(set.labels.join(' . '), x, y);
      });

    gridContext.textAlign = 'center';
    this._grid.columns
      .map((col, idx) => ({ labels: col.labels, idx }))
      .filter(set => set.labels && set.labels.length > 0)
      .forEach(set => {
        const x = set.idx * this._size + (this._size / 2) + 2;
        set.labels.forEach((label, idx) => {
          gridContext.fillText(label + '', x, grid_h + ((font_size * 1.2) * (idx + 1.2)));
        });
      });
  }

  private clearContext(context: CanvasRect) {
    context.clearRect(0, 0, this.totalWidth, this.totalHeight);
  }

  private getCoords(locator: { offsetX: number, offsetY: number, which: number }): GridContextPoint {
    const colIdx = Griddler.Round(locator.offsetX * Griddler.RESOLUTION / this._size, 0, 1, 0, this.totalColumns);
    const rowIdx = Griddler.Round(locator.offsetY * Griddler.RESOLUTION / this._size, 0, 1, 0, this.totalRows);
    const gridDims = { 
      x: colIdx === this.totalColumns ? null : colIdx + 1,
      y: rowIdx === this.totalRows ? null : rowIdx + 1,
    };
    return { 
      x: gridDims.x,
      y: gridDims.y,
      x0: colIdx * this._size + Griddler.PIXEL_ADJUST,
      y0: rowIdx * this._size + Griddler.PIXEL_ADJUST,
      which: locator.which,
      state: this.getState(gridDims),
      ctx: this._gridCanvas.getContext('2d'),
    };
  }

  private highlight(coords: GridContextPoint) {
    this.clearContext(this._hiContext);
    if (coords.x) this._hiContext.fillRect(coords.x0, 0, this._size, this.totalHeight);
    if (coords.y) this._hiContext.fillRect(0, coords.y0, this.totalWidth, this._size);
    if (coords.x && coords.y) {
      this._hiContext.clearRect(coords.x0, coords.y0, this._size, this._size);
    }
  }

  private log(coords: GridContextPoint) {
    console.log(coords);
  }
}

interface Point {
  x: number;
  y: number;
}

interface GridContextPoint extends Point {
  x0: number;
  y0: number;
  which: number;
  state: 0 | 1 | 2;
  ctx: CanvasRenderingContext2D;
}