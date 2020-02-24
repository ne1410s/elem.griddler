import { CustomElementBase } from '@ne1410s/cust-elems';
import markupUrl from './griddler.html';
import stylesUrl from './griddler.css';
import { PlainGrid } from '../../format/plain-grid';
import { Grid } from '../../solve/grid';
import { XGrid } from '../../format/xgrid';
import { DenseGrid } from '../../format/dense-grid';

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
  private readonly _hiliteCanvas: HTMLCanvasElement;
  private readonly _hiliteContext: CanvasRenderingContext2D;

  private _size = Griddler.SIZE_DEF;
  private _grid = XGrid.AsPlain({ x: Griddler.XY_DEF, y: Griddler.XY_DEF });

  get totalColumns(): number { return this._grid.columns.length; }
  get totalRows(): number { return this._grid.rows.length; }

  get totalWidth(): number { return this._gridCanvas.width; }
  set totalWidth(value: number) {
    this._gridCanvas.width = value;
    this._hiliteCanvas.width = value;
  }

  get totalHeight(): number { return this._gridCanvas.height; }
  set totalHeight(value: number) {
    this._gridCanvas.height = value;
    this._hiliteCanvas.height = value;
  }

  constructor() {
    super(stylesUrl, markupUrl);

    this._gridCanvas = this.root.querySelector('canvas#grid');
    this._hiliteCanvas = this.root.querySelector('canvas#hilite');
    this._hiliteContext = this._hiliteCanvas.getContext('2d');
    this._hiliteContext.imageSmoothingEnabled = false;

    this._gridCanvas.addEventListener('mouseleave', () => this.clearContext(this._hiliteContext));
    this._gridCanvas.addEventListener('mousemove', (e: MouseEvent) => this.onMouseMove(e));
    this._gridCanvas.addEventListener('click', (e: MouseEvent) => this.onMouseClick(e));

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
    this._grid.rows.forEach(r => r.cells = null);
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

    this._hiliteContext.fillStyle = Griddler.HIGHLIGHT;
    
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

  private populate(gridContext: CanvasRenderingContext2D) {

    // cell states
    gridContext.beginPath();
    this._grid.rows
      .map((row, idx) => ({ cells: row.cells, idx }))
      .forEach(row => (row.cells || [])
        .map((state, idx) => ({ state, idx }))
        .forEach(cell => {
          switch (cell.state) {
            case 1:
              gridContext.rect(
                cell.idx * this._size + Griddler.PIXEL_ADJUST,
                row.idx * this._size + Griddler.PIXEL_ADJUST,
                this._size, this._size);
              break;
            case 2:
              const x0 = cell.idx * this._size + Griddler.PIXEL_ADJUST + (this._size / 2);
              const y0 = row.idx * this._size + Griddler.PIXEL_ADJUST + (this._size / 2);
              gridContext.moveTo(x0, y0);
              gridContext.arc(x0, y0, this._size / 8, 0, 2 * Math.PI);
              break;
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

  private getCoords(offsetX: number, offsetY: number): { x: number, y: number } {
    return {
      x: Griddler.Round(offsetX * Griddler.RESOLUTION / this._size, 0, 1, 0, this.totalColumns),
      y: Griddler.Round(offsetY * Griddler.RESOLUTION / this._size, 0, 1, 0, this.totalRows),
    };
  }

  private onMouseMove(event: MouseEvent) {

    const coords = this.getCoords(event.offsetX, event.offsetY);
    const x0 = coords.x * this._size + Griddler.PIXEL_ADJUST;
    const y0 = coords.y * this._size + Griddler.PIXEL_ADJUST;
    this.clearContext(this._hiliteContext);
    
    if (coords.x !== this.totalColumns) {
      this._hiliteContext.fillRect(x0, 0, this._size, this.totalHeight);
    }
    if (coords.y !== this.totalRows) {
      this._hiliteContext.fillRect(0, y0, this.totalWidth, this._size);
    }
    if (coords.x !== this.totalColumns && coords.y !== this.totalRows) {
      this._hiliteContext.clearRect(x0, y0, this._size, this._size);
    }
  }

  private onMouseClick(event: MouseEvent) {
    
    const coords = this.getCoords(event.offsetX, event.offsetY);
    if (coords.x === this.totalColumns && coords.y !== this.totalRows) {
      console.log('Clicked on label for row ' + coords.y);
    } else if (coords.x !== this.totalColumns && coords.y === this.totalRows) {
      console.log('Clicked on label for col ' + coords.x);
    } else if (coords.x !== this.totalColumns && coords.y !== this.totalColumns) {
      console.log('Click on cell', coords);
    }
    
  } 
}
