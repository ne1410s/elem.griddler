import { CustomElementBase } from '@ne1410s/cust-elems';
import markupUrl from './griddler.html';
import stylesUrl from './griddler.css';

export class Griddler extends CustomElementBase {

  public static observedAttributes = ['cols', 'rows', 'size'];

  private static readonly XY_MIN = 5;
  private static readonly XY_MAX = 1000;
  private static readonly XY_INTERVAL = 5;
  private static readonly DEF_X = 25;
  private static readonly DEF_Y = 35;
  private static readonly MINOR_COL = '#eee';
  private static readonly MAJOR_COL = '#555';
  private static readonly HIGHLIGHT = 'rgba(0, 0, 200, 0.4)';
  private static readonly RESOLUTION = 10;

  private static readonly SIZE_MIN = 5 * Griddler.RESOLUTION;
  private static readonly SIZE_MAX = 50 * Griddler.RESOLUTION;
  private static readonly SIZE_INTERVAL = 1 * Griddler.RESOLUTION;
  private static readonly DEF_SIZE = 20 * Griddler.RESOLUTION;
  private static readonly PIXEL_ADJUST = .5 * Griddler.RESOLUTION;
  private static readonly LABEL_ROOM = 5 * Griddler.RESOLUTION;
  
  private readonly _gridCanvas: HTMLCanvasElement;
  private readonly _hiliteCanvas: HTMLCanvasElement;
  private readonly _hiliteContext: CanvasRenderingContext2D;
  
  private _cols = Griddler.DEF_X;
  private _rows = Griddler.DEF_Y;
  private _size = Griddler.DEF_SIZE;

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

    this._gridCanvas.addEventListener('mouseleave', () => this.clear(this._hiliteContext));
    this._gridCanvas.addEventListener('mousemove', (e: MouseEvent) => this.onMouseMove(e));
    this._gridCanvas.addEventListener('click', (e: MouseEvent) => this.onMouseClick(e));
  }  

  /**
   * Draws a new grid according to the current size configuration.
   */
  redraw(): void {
    const labels_w = this._cols * Griddler.LABEL_ROOM;
    const labels_h = this._rows * Griddler.LABEL_ROOM;
    const grid_w = this._cols * this._size + Griddler.PIXEL_ADJUST;
    const grid_h = this._rows * this._size + Griddler.PIXEL_ADJUST;

    this.totalWidth = grid_w + labels_w;
    this.totalHeight = grid_h + labels_h;
    const client_w = this.totalWidth / Griddler.RESOLUTION;
    this.root.querySelector('.root').setAttribute('style', `max-width: ${client_w}px`);

    const gridContext = this._gridCanvas.getContext('2d');
    this.clear(gridContext);
    gridContext.imageSmoothingEnabled = false;
    gridContext.beginPath();
    for (let c = 0; c <= this._cols; c++) {
      gridContext.moveTo(c * this._size + Griddler.PIXEL_ADJUST, 0);
      gridContext.lineTo(c * this._size + Griddler.PIXEL_ADJUST, grid_h);
    }
    for (let r = 0; r <= this._rows; r++) {
      gridContext.moveTo(0, r * this._size + Griddler.PIXEL_ADJUST);
      gridContext.lineTo(grid_w, r * this._size + Griddler.PIXEL_ADJUST);
    }
    gridContext.strokeStyle = Griddler.MINOR_COL;
    gridContext.lineWidth = Griddler.RESOLUTION;
    gridContext.stroke();    
    gridContext.closePath();

    gridContext.beginPath();
    for (let ci = 0; ci <= this._cols; ci += Griddler.XY_INTERVAL) {
      gridContext.moveTo(ci * this._size + Griddler.PIXEL_ADJUST, 0);
      gridContext.lineTo(ci * this._size + Griddler.PIXEL_ADJUST, grid_h);
    }
    for (let ri = 0; ri <= this._rows; ri += Griddler.XY_INTERVAL) {
      gridContext.moveTo(0, ri * this._size + Griddler.PIXEL_ADJUST);
      gridContext.lineTo(grid_w, ri * this._size + Griddler.PIXEL_ADJUST);
    }
    gridContext.strokeStyle = Griddler.MAJOR_COL;
    gridContext.lineWidth = Griddler.RESOLUTION;
    gridContext.stroke();    
    gridContext.closePath();
  }

  connectedCallback() {
    this.redraw();
    this._hiliteContext.fillStyle = Griddler.HIGHLIGHT;
  }
  
  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    switch (name) {
      case 'cols':
        this._cols = Griddler.Round(
          newValue,
          Griddler.DEF_X,
          Griddler.XY_INTERVAL,
          Griddler.XY_MIN,
          Griddler.XY_MAX);
        break;
      case 'rows':
        this._rows = Griddler.Round(
          newValue,
          Griddler.DEF_Y,
          Griddler.XY_INTERVAL,
          Griddler.XY_MIN,
          Griddler.XY_MAX);
        break;
      case 'size':
        this._size = Griddler.Round(
          newValue,
          Griddler.DEF_SIZE,
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

  private clear(context: CanvasRect) {
    context.clearRect(0, 0, this.totalWidth, this.totalHeight);
  }

  private getCoords(offsetX: number, offsetY: number): { x: number, y: number } {
    return {
      x: Griddler.Round(offsetX * Griddler.RESOLUTION / this._size, 0, 1, 0, this._cols),
      y: Griddler.Round(offsetY * Griddler.RESOLUTION / this._size, 0, 1, 0, this._rows),
    };
  }

  private onMouseMove(event: MouseEvent) {

    const coords = this.getCoords(event.offsetX, event.offsetY);
    this.clear(this._hiliteContext);
    
    if (coords.x !== this._cols) {
      this._hiliteContext.fillRect(coords.x * this._size + Griddler.PIXEL_ADJUST, 0, this._size, this.totalHeight);
    }
    if (coords.y !== this._rows) {
      this._hiliteContext.fillRect(0, coords.y * this._size + Griddler.PIXEL_ADJUST, this.totalWidth, this._size);
    }
  }

  private onMouseClick(event: MouseEvent) {
    
    const coords = this.getCoords(event.offsetX, event.offsetY);
    if (coords.x === this._cols && coords.y !== this._rows) {
      console.log('Clicked on label for row ' + coords.y);
    } else if (coords.x !== this._cols && coords.y === this._rows) {
      console.log('Clicked on label for col ' + coords.x);
    } else if (coords.x !== this._cols && coords.y !== this._cols) {
      console.log('Click on cell', coords);
    }
    
  } 
}
