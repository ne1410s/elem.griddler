import { CustomElementBase } from '@ne1410s/cust-elems';
import { q, ChainedQuery } from '@ne1410s/dom';

import { PlainGrid } from '../../format/plain-grid';
import { Grid } from '../../solve/grid';
import { XGrid } from '../../format/xgrid';
import { DenseGrid } from '../../format/dense-grid';
import { EditLabelPopup } from '../popups/edit-label/edit-label';

import * as config from './config.json';
import markupUrl from './griddler.html';
import stylesUrl from './griddler.css';

export class Griddler extends CustomElementBase {

  public static observedAttributes = ['cols', 'rows', 'size'];

  private static readonly PIXEL_OFFSET = config.resolution / 2;
  
  private readonly $root: ChainedQuery;
  private readonly $grid: ChainedQuery;
  private readonly $lite: ChainedQuery;
  
  private readonly _ctxGrid: CanvasRenderingContext2D;
  private readonly _ctxLite: CanvasRenderingContext2D;

  private _size = config.cellSize.default * config.resolution;
  private _grid = XGrid.AsPlain({ x: config.gridSize.default, y: config.gridSize.default });
  private _downCoords: GridContextPoint;
  private _history: string[] = [];
  private _historyIndex: number = 0;
  private _editLabelPopup: EditLabelPopup;
  private _fontSize = this._size * .55;

  get totalColumns(): number { return this._grid.columns.length; }
  get totalRows(): number { return this._grid.rows.length; }

  get totalWidth(): number { return (this.$grid.elements[0] as HTMLCanvasElement).width; }
  set totalWidth(value: number) {
    this.$grid.prop('width', value);
    this.$lite.prop('width', value);
  }

  get totalHeight(): number { return (this.$grid.elements[0] as HTMLCanvasElement).height; }
  set totalHeight(value: number) {
    this.$grid.prop('height', value);
    this.$lite.prop('height', value);
  }

  get isBlank(): boolean {
    return !this._grid.rows.some(r => r.cells && /[12]/.test(r.cells + ''));
  }

  get isFull(): boolean {
    return this._grid.rows.every(r => /^[12,]+$/.test(r.cells + ''));
  }

  public toString(): string {
    return JSON.stringify(XGrid.ToDense(this._grid));
  }

  get textDataUrl(): string {
    const encoded = window.encodeURIComponent(this.toString());
    return `data:text/plain;charset=utf-8,${encoded}`;
  }

  get imageDataUrl(): string {
    return (this.$grid.get(0) as HTMLCanvasElement).toDataURL();
  }

  constructor() {
    super(stylesUrl, markupUrl);

    this.$root = q(this.root);

    this.$grid = this.$root.first('canvas#grid');
    this._ctxGrid = (this.$grid.get(0) as HTMLCanvasElement).getContext('2d');
    this._ctxGrid.imageSmoothingEnabled = false;

    this.$lite = this.$root.first('canvas#hilite');
    this._ctxLite = (this.$lite.get(0) as HTMLCanvasElement).getContext('2d');
    this._ctxLite.imageSmoothingEnabled = false;

    this.$grid.on('mouseleave', () => { 
      if (!this._downCoords) this.clearContext(this._ctxLite);
    });
    this.$grid.on('mousemove', (e: MouseEvent) => {
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
    this.$grid.on('mousedown', (e: MouseEvent) => {
      this._downCoords = this.getCoords(e, true);
      this.highlight();
    });
    this.$grid.on('mouseup', (e: MouseEvent) => {

      e.stopImmediatePropagation();
      const upCoords = this.getCoords(e);
      this.highlight(upCoords);

      if (this._downCoords) {
        if (upCoords.x === this._downCoords.x && upCoords.y === this._downCoords.y) {
          if (upCoords.x != null && upCoords.y != null) { // cell
            let state: 0 | 1 | 2;
            switch (this._downCoords.which) {
              case 'left': state = (this._downCoords.state + 1) % 3 as 0 | 1 | 2; break;
              case 'right': state = this._downCoords.state === 2 ? 0 : 2; break;
            }

            this.setState(this._downCoords, state);
          }
          else if (upCoords.x != null) this.showLabelModal('columns', upCoords.x);
          else if (upCoords.y != null) this.showLabelModal('rows', upCoords.y);
        }

        if (this._downCoords.pending) {
          this.addToHistory(this._downCoords.snapshot);
        }

        this._downCoords = null;
      }
    });

    q(window).on('mouseup', () => {
      this._downCoords = null;
      this.clearContext(this._ctxLite);
    });
    
    this.$grid.on('contextmenu', event => event.preventDefault());

    this.$root.find('#btnRedo').on('click', () => this.gotoHistory(this._historyIndex + 1));
    this.$root.find('#btnUndo').on('click', () => this.undoOne());
    this.$root.find('#btnClear').on('click', () => this.clear());
    this.$root.find('#btnSolve').on('click', () => this.solve());
    this.$root.find('#btnDownload').on('click', () => Griddler.Download(this.imageDataUrl, 'My Grid.png'));
    this.$root.find('#btnPrint').on('click', () => window.print());
    this.$root.find('#btnExport').on('click', () => Griddler.Download(this.textDataUrl, 'My Grid.json'));
    this.$root.find('#btnImport input').on('change', event => {
      this.read((event.target as HTMLInputElement).files[0]);
    });
    this.$root.find('.drop-zone').on('dragover', event => event.preventDefault());
    this.$root.find('.drop-zone').on('drop', (event: DragEvent) => {
      event.preventDefault();
      this.read(event.dataTransfer.files[0]);
    });

    this._editLabelPopup = new EditLabelPopup();
    this.$root
      .append(this._editLabelPopup)
      .find('ne14-pop-edit-label')
      .on('confirmaccept', () => this.receiveLabelUpdate());
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
    if (!this.isBlank) {
      this.addToHistory(this.toString());
      XGrid.WipeCells(this._grid);
      this.refresh();
    }
  }

  /** Attempts to solve the grid. */
  solve() {
    if (!this.isFull) {
      const result = Grid.load(this._grid).solve();
      if (result.solved) {
        console.log('Solved in ' + result.solvedMs + 'ms');
        this.addToHistory(this.toString());
        this.load(result.grid);
      }
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

    this.clearContext(this._ctxGrid);
    this._ctxGrid.fillStyle = '#fff';
    this._ctxGrid.fillRect(0, 0, this.totalWidth, this.totalHeight);
    this._ctxGrid.beginPath();
    for (let c = 0; c <= this.totalColumns; c++) {
      this._ctxGrid.moveTo(c * this._size + Griddler.PIXEL_OFFSET, 0);
      this._ctxGrid.lineTo(c * this._size + Griddler.PIXEL_OFFSET, grid_h);
    }
    for (let r = 0; r <= this.totalRows; r++) {
      this._ctxGrid.moveTo(0, r * this._size + Griddler.PIXEL_OFFSET);
      this._ctxGrid.lineTo(grid_w, r * this._size + Griddler.PIXEL_OFFSET);
    }
    this._ctxGrid.strokeStyle = config.palette.minor;
    this._ctxGrid.lineWidth = config.resolution;
    this._ctxGrid.stroke();    
    this._ctxGrid.closePath();

    this._ctxGrid.beginPath();
    for (let c = 0; c <= this.totalColumns; c += config.gridSize.step) {
      this._ctxGrid.moveTo(c * this._size + Griddler.PIXEL_OFFSET, 0);
      this._ctxGrid.lineTo(c * this._size + Griddler.PIXEL_OFFSET, grid_h);
    }
    for (let r = 0; r <= this.totalRows; r += config.gridSize.step) {
      this._ctxGrid.moveTo(0, r * this._size + Griddler.PIXEL_OFFSET);
      this._ctxGrid.lineTo(grid_w, r * this._size + Griddler.PIXEL_OFFSET);
    }
    this._ctxGrid.strokeStyle = config.palette.major;
    this._ctxGrid.lineWidth = config.resolution;
    this._ctxGrid.stroke();    
    this._ctxGrid.closePath();
    
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

  private read(file: File) {
    if (file == null) return;
    const reader = new FileReader();
    reader.onload = e => {
      const current = this.toString();
      const loaded = e.target.result as string;
      if (loaded !== current) {
        this.load(JSON.parse(loaded));
        this.addToHistory(current);
      }
    }
    reader.readAsText(file);
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
        this._ctxGrid.beginPath();
        this.setCell(point.x, point.y);
        this._ctxGrid.fillStyle = '#fff';
        this._ctxGrid.fill();
        this._ctxGrid.beginPath();
        switch (state) {
          case 1: this.setCell(point.x, point.y); break;
          case 2: this.markCell(point.x, point.y); break;
        }
        this._ctxGrid.fillStyle = config.palette.cells;
        this._ctxGrid.fill();

        if (this._downCoords?.snapshot) {
          this._downCoords.pending = true;
        }
      }
    }
  }

  private markCell(ci: number, ri: number) {
    const x0 = ci * this._size + Griddler.PIXEL_OFFSET + (this._size / 2);
    const y0 = ri * this._size + Griddler.PIXEL_OFFSET + (this._size / 2);
    this._ctxGrid.moveTo(x0, y0);
    this._ctxGrid.arc(x0, y0, this._size / 8, 0, 2 * Math.PI);
  }

  private setCell(ci: number, ri: number) {
    const buffer = 2 * Griddler.PIXEL_OFFSET;
    this._ctxGrid.rect(
      ci * this._size + buffer,
      ri * this._size + buffer,
      this._size - buffer,
      this._size - buffer);
  }

  private populate() {
    // labels
    this._ctxGrid.font = `${this._fontSize}px Times New Roman`;
    this._ctxGrid.fillStyle = config.palette.label;
    
    const grid_w = this.totalColumns * this._size + Griddler.PIXEL_OFFSET;
    this._grid.rows
    .map((row, idx) => ({ labels: row.labels, idx }))
    .filter(set => set.labels && set.labels.length > 0)
    .forEach(set => this.setRowLabels(set.idx, set.labels, grid_w));
    
    const grid_h = this.totalRows * this._size + Griddler.PIXEL_OFFSET;
    this._grid.columns
      .map((col, idx) => ({ labels: col.labels, idx }))
      .filter(set => set.labels && set.labels.length > 0)
      .forEach(set => this.setColumnLabels(set.idx, set.labels, grid_h));

    // cell states
    this._ctxGrid.beginPath();
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
    this._ctxGrid.fillStyle = config.palette.cells;
    this._ctxGrid.fill();
  }

  private setRowLabels(idx: number, labels: number[], grid_w?: number) {  
    const isBulk = !!grid_w;
    grid_w = grid_w || this.totalColumns * this._size + Griddler.PIXEL_OFFSET;
    const x = grid_w + (this._fontSize / 2);
    const y = idx * this._size + (this._size / 2) + (this._fontSize / 2);
    this._ctxGrid.textAlign = 'left';
    if (!isBulk) this._ctxGrid.clearRect(x, idx * this._size, this.totalWidth, this._size);
    this._ctxGrid.fillText(labels.join(' . '), x, y);
  }

  private setColumnLabels(idx: number, labels: number[], grid_h?: number) {
    const isBulk = !!grid_h;
    grid_h = grid_h || this.totalRows * this._size + Griddler.PIXEL_OFFSET;
    const x = idx * this._size + (this._size / 2) + 2;
    this._ctxGrid.textAlign = 'center';
    if (!isBulk) this._ctxGrid.clearRect(idx * this._size, grid_h, this._size, this.totalHeight)
    labels.forEach((label, idx) => {
      this._ctxGrid.fillText(label + '', x, grid_h + ((this._fontSize * 1.2) * (idx + 1.2)));
    });
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
    this.clearContext(this._ctxLite);
    const state = coords ? -1 : this._downCoords?.which === 'left' ? 1 : 2;
    this._ctxLite.fillStyle = this.getShade(state);
    coords = coords ?? this._downCoords;
    if (coords.x != null) this._ctxLite.fillRect(coords.x0, 0, this._size, this.totalHeight);
    if (coords.y != null) this._ctxLite.fillRect(0, coords.y0, this.totalWidth, this._size);
    if (coords.x != null && coords.y != null) {
      const buffer = 2 * Griddler.PIXEL_OFFSET;
      this._ctxLite.clearRect(
        coords.x0 + buffer,
        coords.y0 + buffer,
        this._size - 2 * buffer,
        this._size - 2 * buffer);
    }
  }

  private showLabelModal(type: 'columns' | 'rows', index: number) {
    this._editLabelPopup.setType = type;
    this._editLabelPopup.setIndex = index;
    this._editLabelPopup.capacity = this._grid[type === 'rows' ? 'columns' : 'rows'].length;
    this._editLabelPopup.labels = this._grid[type][index].labels;
    this._editLabelPopup.open();
  }

  private receiveLabelUpdate() {
    const type = this._editLabelPopup.setType;
    const index = this._editLabelPopup.setIndex;
    const set = this._grid[type][index];
    const next = this._editLabelPopup.labels;
    if (next.join(',') !== set.labels.join(',')) {
      this.addToHistory(this.toString());
      set.labels = next;
      if (type === 'rows') this.setRowLabels(index, next);
      else this.setColumnLabels(index, next);
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