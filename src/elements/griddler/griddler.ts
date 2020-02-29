import { CustomElementBase } from '@ne1410s/cust-elems';
import { PlainGrid } from '../../format/plain-grid';
import { Grid } from '../../solve/grid';
import { XGrid } from '../../format/xgrid';
import { DenseGrid } from '../../format/dense-grid';
import * as config from './config.json';
import markupUrl from './griddler.html';
import stylesUrl from './griddler.css';

export class Griddler extends CustomElementBase {

  public static observedAttributes = ['cols', 'rows', 'size'];

  private static readonly PIXEL_OFFSET = config.resolution / 2;
  
  private readonly _gridCanvas: HTMLCanvasElement;
  private readonly _gridContext: CanvasRenderingContext2D;
  private readonly _hiCanvas: HTMLCanvasElement;
  private readonly _hiContext: CanvasRenderingContext2D;

  private _size = config.cellSize.default * config.resolution;
  private _grid = XGrid.AsPlain({ x: config.gridSize.default, y: config.gridSize.default });
  private _downCoords: GridContextPoint;
  private _history: string[] = [];
  private _historyIndex: number = 0;

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
      
      // Check for dragging on initial-cell
      const isColDrag = this._downCoords?.x === moveCoords.x;
      const isRowDrag = this._downCoords?.y === moveCoords.y;
      this.highlight(!this._downCoords ? moveCoords : null);
      
      // If ripe for the paintin'
      if ((isColDrag || isRowDrag) && moveCoords.state === 0) {
        this.setState(moveCoords, this._downCoords.which === 'left' ? 1 : 2);
      }
    });
    this._gridCanvas.addEventListener('mousedown', event => {
      this._downCoords = this.getCoords(event, true);
      this.highlight();
    });
    this._gridCanvas.addEventListener('mouseup', event => {

      event.stopImmediatePropagation();
      const upCoords = this.getCoords(event);
      this.highlight(upCoords);

      if (this._downCoords) {
        if (upCoords.x === this._downCoords.x && upCoords.y === this._downCoords.y) {
          let state: 0 | 1 | 2;
          switch (this._downCoords.which) {
            case 'left': state = (this._downCoords.state + 1) % 3 as 0 | 1 | 2; break;
            case 'right': state = this._downCoords.state === 2 ? 0 : 2; break;
          }

          this.setState(this._downCoords, state);
        }

        if (this._downCoords.pending) {
          this.addToHistory(this._downCoords.snapshot);
        }

        this._downCoords = null;
      }
    });
    window.addEventListener('mouseup', () => {
      this._downCoords = null;
      this.clearContext(this._hiContext);
    });
    
    this._gridCanvas.addEventListener('contextmenu', event => event.preventDefault());
    this.root.querySelector('#btnSolve').addEventListener('click', () => this.solve());
    this.root.querySelector('#btnClear').addEventListener('click', () => this.clear());
    this.root.querySelector('#btnExport').addEventListener('click', () => Griddler.Download(this.textDataUrl, 'My Grid.json'));
    this.root.querySelector('#btnDownload').addEventListener('click', () => Griddler.Download(this.imageDataUrl, 'My Grid.png'));
    this.root.querySelector('#btnPrint').addEventListener('click', () => window.print());
    this.root.querySelector('#btnRedo').addEventListener('click', () => this.gotoHistory(this._historyIndex + 1));
    this.root.querySelector('#btnUndo').addEventListener('click', () => this.undoOne());
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

    if (this._grid.rows.some(r => r.cells && /[12]/.test(r.cells + ''))) {
      this.addToHistory(this.toString());
    }

    XGrid.WipeCells(this._grid);
    this.refresh();
  }

  /** Attempts to solve the grid. */
  solve() {

    console.warn('TODO: Prevent unmeaningul changes from being tracked!');
    this.addToHistory(this.toString());

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
    const grid_w = this.totalColumns * this._size + Griddler.PIXEL_OFFSET;
    const grid_h = this.totalRows * this._size + Griddler.PIXEL_OFFSET;
    const labels_w = grid_w * 2 / 5;
    const labels_h = grid_h * 2 / 5;

    this.totalWidth = grid_w + labels_w;
    this.totalHeight = grid_h + labels_h;
    const client_w = this.totalWidth / config.resolution;
    this.root.querySelector('.grid-zone').setAttribute('style', `width: ${client_w}px`);

    this.clearContext(this._gridContext);
    this._gridContext.fillStyle = '#fff';
    this._gridContext.fillRect(0, 0, this.totalWidth, this.totalHeight);
    this._gridContext.beginPath();
    for (let c = 0; c <= this.totalColumns; c++) {
      this._gridContext.moveTo(c * this._size + Griddler.PIXEL_OFFSET, 0);
      this._gridContext.lineTo(c * this._size + Griddler.PIXEL_OFFSET, grid_h);
    }
    for (let r = 0; r <= this.totalRows; r++) {
      this._gridContext.moveTo(0, r * this._size + Griddler.PIXEL_OFFSET);
      this._gridContext.lineTo(grid_w, r * this._size + Griddler.PIXEL_OFFSET);
    }
    this._gridContext.strokeStyle = config.palette.minor;
    this._gridContext.lineWidth = config.resolution;
    this._gridContext.stroke();    
    this._gridContext.closePath();

    this._gridContext.beginPath();
    for (let c = 0; c <= this.totalColumns; c += config.gridSize.step) {
      this._gridContext.moveTo(c * this._size + Griddler.PIXEL_OFFSET, 0);
      this._gridContext.lineTo(c * this._size + Griddler.PIXEL_OFFSET, grid_h);
    }
    for (let r = 0; r <= this.totalRows; r += config.gridSize.step) {
      this._gridContext.moveTo(0, r * this._size + Griddler.PIXEL_OFFSET);
      this._gridContext.lineTo(grid_w, r * this._size + Griddler.PIXEL_OFFSET);
    }
    this._gridContext.strokeStyle = config.palette.major;
    this._gridContext.lineWidth = config.resolution;
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
          config.gridSize.default,
          config.gridSize.step,
          config.gridSize.min,
          config.gridSize.max);
        this.load(XGrid.AsPlain({ x: totalColumns, y: this.totalRows }));
        break;
      case 'rows':
        const totalRows = Griddler.Round(
          newValue,
          config.gridSize.default,
          config.gridSize.step,
          config.gridSize.min,
          config.gridSize.max);
        this.load(XGrid.AsPlain({ x: this.totalColumns, y: totalRows }));
        break;
      case 'size':
        this._size = Griddler.Round(
          newValue,
          config.cellSize.default * config.resolution,
          config.cellSize.step * config.resolution,
          config.cellSize.min * config.resolution,
          config.cellSize.max * config.resolution);
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

  private addToHistory(snapshot: string): void {
    this._history.splice(this._historyIndex);
    this._historyIndex = this._history.push(snapshot);
    this.historyChanged();
  }

  private historyChanged(): void {
    const btnUndo = this.root.querySelector('#btnUndo') as HTMLInputElement;
    const btnRedo = this.root.querySelector('#btnRedo') as HTMLInputElement;
    btnUndo.disabled = this._historyIndex <= 0;
    btnRedo.disabled = this._historyIndex >= this._history.length - 1;
  }

  private gotoHistory(newIndex: number): void {
    if (newIndex === this._historyIndex) return;
    const snapshot = this._history[newIndex];
    if (snapshot) {
      this._historyIndex = newIndex;
      this.load(JSON.parse(snapshot));
      this.historyChanged();
    }
  }

  private undoOne(): void {
    if (this._historyIndex === this._history.length) {  
      const curr = this.toString();
      if (curr !== this._history[this._historyIndex]) {
        this.addToHistory(curr);
        this._historyIndex--;
      }
    }

    this.gotoHistory(this._historyIndex - 1);
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
        this._gridContext.fillStyle = config.palette.cells;
        this._gridContext.fill();

        if (this._downCoords?.snapshot) {
          this._downCoords.pending = true;
        }
      }
    }
  }

  private markCell(ci: number, ri: number) {
    const x0 = ci * this._size + Griddler.PIXEL_OFFSET + (this._size / 2);
    const y0 = ri * this._size + Griddler.PIXEL_OFFSET + (this._size / 2);
    this._gridContext.moveTo(x0, y0);
    this._gridContext.arc(x0, y0, this._size / 8, 0, 2 * Math.PI);
  }

  private setCell(ci: number, ri: number) {
    const buffer = 2 * Griddler.PIXEL_OFFSET;
    this._gridContext.rect(
      ci * this._size + buffer,
      ri * this._size + buffer,
      this._size - buffer,
      this._size - buffer);
  }

  private populate() {

    // labels
    const grid_w = this.totalColumns * this._size + Griddler.PIXEL_OFFSET;
    const grid_h = this.totalRows * this._size + Griddler.PIXEL_OFFSET;
    const font_size = this._size * .55;
    this._gridContext.font = `${font_size}px Times New Roman`;
    this._gridContext.fillStyle = config.palette.label;

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
    this._gridContext.fillStyle = config.palette.cells;
    this._gridContext.fill();
  }

  private clearContext(context: CanvasRenderingContext2D) {
    context.clearRect(0, 0, this.totalWidth, this.totalHeight);
  }

  private getCoords(locator: { offsetX: number, offsetY: number, which: number }, snapshot = false): GridContextPoint {
    const ci = Griddler.Round(locator.offsetX * config.resolution / this._size, 0, 1, 0, this.totalColumns);
    const ri = Griddler.Round(locator.offsetY * config.resolution / this._size, 0, 1, 0, this.totalRows);
    const dims = {
      x: ci === this.totalColumns ? null : ci,
      y: ri === this.totalRows ? null : ri,
    }
    return { 
      ...dims,
      x0: dims.x * this._size + Griddler.PIXEL_OFFSET,
      y0: dims.y * this._size + Griddler.PIXEL_OFFSET,
      which: locator.which === 1 ? 'left' : 'right',
      state: this.getState(dims),
      snapshot: snapshot ? this.toString() : null,
    };
  }

  private getShade(state: number): string {
    switch (state) {
      case -1: return config.hilite.default;
      case 2: return config.hilite.marking;
      default:
        return config.hilite.filling;
    }
  } 

  private highlight(coords?: GridContextPoint) {
    this.clearContext(this._hiContext);
    const state = coords ? -1 : this._downCoords?.which === 'left' ? 1 : 2;
    this._hiContext.fillStyle = this.getShade(state);
    coords = coords ?? this._downCoords;
    if (coords.x != null) this._hiContext.fillRect(coords.x0, 0, this._size, this.totalHeight);
    if (coords.y != null) this._hiContext.fillRect(0, coords.y0, this.totalWidth, this._size);
    if (coords.x != null && coords.y != null) {
      const buffer = 2 * Griddler.PIXEL_OFFSET;
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
  which: 'left' | 'right';
  state: 0 | 1 | 2;
  snapshot: string;
  pending?: boolean;
}