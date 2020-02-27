import { CustomElementBase } from '@ne1410s/cust-elems';
import { PlainGrid } from '../../format/plain-grid';
import { Grid } from '../../solve/grid';
import { XGrid } from '../../format/xgrid';
import { DenseGrid } from '../../format/dense-grid';
import markupUrl from './griddler.html';
import stylesUrl from './griddler.css';
import { Utils } from '../../format/utils';

export class Griddler extends CustomElementBase {

  public static observedAttributes = ['cols', 'rows', 'size'];

  private static readonly XY_MIN = 5;
  private static readonly XY_MAX = 1000;
  private static readonly XY_INTERVAL = 5;
  private static readonly XY_DEF = 5;
  private static readonly RESOLUTION = 2;
  private static readonly MINOR_COL = '#eee';
  private static readonly MAJOR_COL = '#bbb';
  private static readonly LABEL_COL = '#000';
  private static readonly CELL_COL = '#000';
  private static readonly HILITE = 'rgba(0, 0, 255, .2)';
  private static readonly HILITE_FILLING = 'rgba(0, 255, 0, .2)';
  private static readonly HILITE_MARKING = 'rgba(255, 255, 0, .2)';

  private static readonly SIZE_MIN = 5 * Griddler.RESOLUTION;
  private static readonly SIZE_MAX = 50 * Griddler.RESOLUTION;
  private static readonly SIZE_INTERVAL = 1 * Griddler.RESOLUTION;
  private static readonly SIZE_DEF = 20 * Griddler.RESOLUTION;
  private static readonly PIXEL_ADJUST = .5 * Griddler.RESOLUTION;
  
  private readonly _gridCanvas: HTMLCanvasElement;
  private readonly _gridContext: CanvasRenderingContext2D;
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

  public toString(): string {
    return JSON.stringify(XGrid.ToDense(this._grid));
  }

  get textDataUrl(): string {
    const encoded = window.encodeURIComponent(this.toString());
    return `data:text/plain;charset=utf-8,${encoded}`;
  }

  get imageDataUrl(): string {
    return this._gridCanvas.toDataURL();
  }

  constructor() {

    super(stylesUrl, markupUrl);
    this._gridCanvas = this.root.querySelector('canvas#grid');
    this._gridContext = this._gridCanvas.getContext('2d');
    this._gridContext.imageSmoothingEnabled = false;
    this._hiCanvas = this.root.querySelector('canvas#hilite');
    this._hiContext = this._hiCanvas.getContext('2d');
    this._hiContext.imageSmoothingEnabled = false;

    this._gridCanvas.addEventListener('mouseleave', () => { 
      if (!this._downCoords) this.clearContext(this._hiContext);
    });
    this._gridCanvas.addEventListener('mousemove', (e: MouseEvent) => {
      const moveCoords = this.getCoords(e);
      
      if (this._downCoords?.which === 1) {
        // If left-button-initiated dragging
        this.highlight();
      } else if (this._downCoords?.which !== 1 || (this._downCoords.x === moveCoords.x && this._downCoords.y === moveCoords.y)) {
      // If not dragging (or not left-button-initiated) or else check for initial-cell
        this.highlight(moveCoords);
      }
      
      // If ripe for the paintin'
      if (this._downCoords?.x === moveCoords.x || this._downCoords?.y === moveCoords.y) {
        
        // Left button drag on empty cells (when NOT initiated from a mark):
        if (this._downCoords.which === 1 && moveCoords.state === 0) {
          const state = this._downCoords.state === 2 ? 2 : 1;
          this.setState(moveCoords, state);
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
    this.root.querySelector('#btnExport').addEventListener('click', () => Griddler.Download(this.textDataUrl, 'My Grid.json'));
    this.root.querySelector('#btnDownload').addEventListener('click', () => Griddler.Download(this.imageDataUrl, 'My Grid.png'));
    this.root.querySelector('#btnPrint').addEventListener('click', () => window.print());




    window.addEventListener('keydown', event => {
      console.log('vanilla', event.type);
    });

    window.addEventListener('keydown', Utils.Throttle(event => {
      console.log('throttle', event);
    }, 2000));

    window.addEventListener('keydown', Utils.Debounce(event => {
      console.log('debounce', event);
    }, 2000));
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
    this.root.querySelector('.grid-zone').setAttribute('style', `width: ${client_w}px`);

    this.clearContext(this._gridContext);
    this._gridContext.fillStyle = '#fff';
    this._gridContext.fillRect(0, 0, this.totalWidth, this.totalHeight);
    this._gridContext.beginPath();
    for (let c = 0; c <= this.totalColumns; c++) {
      this._gridContext.moveTo(c * this._size + Griddler.PIXEL_ADJUST, 0);
      this._gridContext.lineTo(c * this._size + Griddler.PIXEL_ADJUST, grid_h);
    }
    for (let r = 0; r <= this.totalRows; r++) {
      this._gridContext.moveTo(0, r * this._size + Griddler.PIXEL_ADJUST);
      this._gridContext.lineTo(grid_w, r * this._size + Griddler.PIXEL_ADJUST);
    }
    this._gridContext.strokeStyle = Griddler.MINOR_COL;
    this._gridContext.lineWidth = Griddler.RESOLUTION;
    this._gridContext.stroke();    
    this._gridContext.closePath();

    this._gridContext.beginPath();
    for (let c = 0; c <= this.totalColumns; c += Griddler.XY_INTERVAL) {
      this._gridContext.moveTo(c * this._size + Griddler.PIXEL_ADJUST, 0);
      this._gridContext.lineTo(c * this._size + Griddler.PIXEL_ADJUST, grid_h);
    }
    for (let r = 0; r <= this.totalRows; r += Griddler.XY_INTERVAL) {
      this._gridContext.moveTo(0, r * this._size + Griddler.PIXEL_ADJUST);
      this._gridContext.lineTo(grid_w, r * this._size + Griddler.PIXEL_ADJUST);
    }
    this._gridContext.strokeStyle = Griddler.MAJOR_COL;
    this._gridContext.lineWidth = Griddler.RESOLUTION;
    this._gridContext.stroke();    
    this._gridContext.closePath();
    
    this.populate();
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

  private static Download(dataUrl: string, filename: string) {
    const tempLink = document.createElement('a');
    tempLink.href = dataUrl;
    tempLink.download = filename;
    tempLink.click();
  }

  private static Round(val: string|number, def: number, to: number, min: number, max: number) {
    val = parseInt(`${val}`)
    const rnd = to * Math.round((isNaN(val) ? def : val) / to);
    return Math.max(min, Math.min(max, rnd));
  }

  private getState(point: Point): 0 | 1 | 2 {
    return point.x == null || point.y == null ? null
      : this._grid.rows[point.y].cells[point.x];
  }

  private setState(point: GridContextPoint, state: 0 | 1 | 2): void {
    if (point.x != null && point.y != null) {
      const celRef = this._grid.rows[point.y].cells;
      if (celRef[point.x] !== state) {
        celRef[point.x] = state;
        this._gridContext.beginPath();
        this.setCell(point.x, point.y);
        this._gridContext.fillStyle = '#fff';
        this._gridContext.fill();
        this._gridContext.beginPath();
        switch (state) {
          case 1: this.setCell(point.x, point.y); break;
          case 2: this.markCell(point.x, point.y); break;
        }
        this._gridContext.fillStyle = Griddler.CELL_COL;
        this._gridContext.fill();
      }
    }
  }

  private markCell(ci: number, ri: number) {
    const x0 = ci * this._size + Griddler.PIXEL_ADJUST + (this._size / 2);
    const y0 = ri * this._size + Griddler.PIXEL_ADJUST + (this._size / 2);
    this._gridContext.moveTo(x0, y0);
    this._gridContext.arc(x0, y0, this._size / 8, 0, 2 * Math.PI);
  }

  private setCell(ci: number, ri: number) {
    const buffer = 2 * Griddler.PIXEL_ADJUST;
    this._gridContext.rect(
      ci * this._size + buffer,
      ri * this._size + buffer,
      this._size - buffer,
      this._size - buffer);
  }

  private populate() {

    // labels
    const grid_w = this.totalColumns * this._size + Griddler.PIXEL_ADJUST;
    const grid_h = this.totalRows * this._size + Griddler.PIXEL_ADJUST;
    const font_size = this._size * .55;
    this._gridContext.font = `${font_size}px Times New Roman`;
    this._gridContext.fillStyle = Griddler.LABEL_COL;

    this._gridContext.textAlign = 'left';
    this._grid.rows
      .map((row, idx) => ({ labels: row.labels, idx }))
      .filter(set => set.labels && set.labels.length > 0)
      .forEach(set => {
        const x = grid_w + (font_size / 2);
        const y = set.idx * this._size + (this._size / 2) + (font_size / 2);
        this._gridContext.fillText(set.labels.join(' . '), x, y);
      });

    this._gridContext.textAlign = 'center';
    this._grid.columns
      .map((col, idx) => ({ labels: col.labels, idx }))
      .filter(set => set.labels && set.labels.length > 0)
      .forEach(set => {
        const x = set.idx * this._size + (this._size / 2) + 2;
        set.labels.forEach((label, idx) => {
          this._gridContext.fillText(label + '', x, grid_h + ((font_size * 1.2) * (idx + 1.2)));
        });
      });

    // cell states
    this._gridContext.beginPath();
    this._grid.rows
      .map((row, idx) => ({ cells: row.cells, idx }))
      .forEach(row => (row.cells || [])
        .map((state, idx) => ({ state, idx }))
        .forEach(cell => {
          switch (cell.state) {
            case 1: this.setCell(cell.idx, row.idx); break;
            case 2: this.markCell(cell.idx, row.idx); break;
          }
        })
      );
    this._gridContext.fillStyle = Griddler.CELL_COL;
    this._gridContext.fill();
  }

  private clearContext(context: CanvasRenderingContext2D) {
    context.clearRect(0, 0, this.totalWidth, this.totalHeight);
  }

  private getCoords(locator: { offsetX: number, offsetY: number, which: number }): GridContextPoint {
    const ci = Griddler.Round(locator.offsetX * Griddler.RESOLUTION / this._size, 0, 1, 0, this.totalColumns);
    const ri = Griddler.Round(locator.offsetY * Griddler.RESOLUTION / this._size, 0, 1, 0, this.totalRows);
    const dims = {
      x: ci === this.totalColumns ? null : ci,
      y: ri === this.totalRows ? null : ri,
    }
    return { 
      ...dims,
      x0: dims.x * this._size + Griddler.PIXEL_ADJUST,
      y0: dims.y * this._size + Griddler.PIXEL_ADJUST,
      which: locator.which,
      state: this.getState(dims)
    };
  }

  private getShade(state: number): string {
    switch (state) {
      case -1: return Griddler.HILITE;
      case 2: return Griddler.HILITE_MARKING;
      default:
        return Griddler.HILITE_FILLING;
    }
  } 

  private highlight(coords?: GridContextPoint, active: boolean = false) {
    this.clearContext(this._hiContext);
    const state = coords ? -1 : this._downCoords?.state ?? 1;
    this._hiContext.fillStyle = this.getShade(state);
    coords = coords ?? this._downCoords;
    if (coords.x != null) this._hiContext.fillRect(coords.x0, 0, this._size, this.totalHeight);
    if (coords.y != null) this._hiContext.fillRect(0, coords.y0, this.totalWidth, this._size);
    if (coords.x != null && coords.y != null) {
      const buffer = 2 * Griddler.PIXEL_ADJUST;
      this._hiContext.clearRect(
        coords.x0 + buffer,
        coords.y0 + buffer,
        this._size - 2 * buffer,
        this._size - 2 * buffer);
    }
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
}