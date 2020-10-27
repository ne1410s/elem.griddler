import { CustomElementBase } from '@ne1410s/cust-elems';
import { ContextMenu } from '@ne1410s/menu';
import { q, ChainedQuery } from '@ne1410s/dom';

import { Grid } from '../../solve/grid';
import { XGrid, PlainGrid, DenseGrid } from '../../models/grid';
import { Point, GridContextPoint, GridEditHistory } from '../../models/meta';

import { SettingsPopup } from '../popups/settings/settings';
import { HistoryPopup } from '../popups/history/history';
import { EditLabelPopup } from '../popups/edit-label/edit-label';
import { PixelsPopup } from '../popups/pixels/pixels';

import * as config from './config.json';
import markupUrl from './griddler.html';
import stylesUrl from './griddler.css';

export class Griddler extends CustomElementBase {
  public static observedAttributes = ['cols', 'rows', 'size'];

  private static readonly PIXEL_OFFSET = config.resolution / 2;

  private readonly $root: ChainedQuery;
  private readonly $grid: ChainedQuery;
  private readonly $lite: ChainedQuery;
  private readonly $menu: ChainedQuery;

  private readonly _ctxGrid: CanvasRenderingContext2D;
  private readonly _ctxLite: CanvasRenderingContext2D;
  private readonly _settingsPopup = new SettingsPopup();
  private readonly _historyPopup = new HistoryPopup();
  private readonly _editLabelPopup = new EditLabelPopup();
  private readonly _pixelsPopup = new PixelsPopup();

  private _size = config.cellSize.default * config.resolution;
  private _grid = XGrid.AsPlain({ x: config.gridSize.default, y: config.gridSize.default });
  private _menuCoords: GridContextPoint;
  private _downCoords: GridContextPoint;
  private _history: GridEditHistory[] = [];
  private _historyIndex: number = 0;
  private _fontSize = this._size * 0.55;

  get totalColumns(): number {
    return this._grid.columns.length;
  }
  get totalRows(): number {
    return this._grid.rows.length;
  }

  get totalWidth(): number {
    return (this.$grid.elements[0] as HTMLCanvasElement).width;
  }
  set totalWidth(value: number) {
    this.$grid.prop('width', value);
    this.$lite.prop('width', value);
  }

  get totalHeight(): number {
    return (this.$grid.elements[0] as HTMLCanvasElement).height;
  }
  set totalHeight(value: number) {
    this.$grid.prop('height', value);
    this.$lite.prop('height', value);
  }

  get isBlank(): boolean {
    return !this._grid.rows.some((r) => r.cells && /[12]/.test(r.cells + ''));
  }

  get isFull(): boolean {
    return this._grid.rows.every((r) => /^[12,]+$/.test(r.cells + ''));
  }

  get anyLabels(): boolean {
    return (
      this._grid.rows.some((r) => r.labels?.length) ||
      this._grid.columns.some((c) => c.labels?.length)
    );
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
    this.$menu = this.$root.first('ne14-menu');
    this.handleMenuEvents();

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
      this.highlight(!this._downCoords ? moveCoords : null);

      // Check for dragging on initiating sets
      const isColDrag = this._downCoords?.x === moveCoords.x;
      const isRowDrag = this._downCoords?.y === moveCoords.y;

      // If ripe for the paintin'
      if ((isColDrag || isRowDrag) && moveCoords.state === 0) {
        // Use initial state (or 0 -> 1 fill blanks)
        this.setState(moveCoords, this._downCoords.state || 1);
      }
    });
    this.$grid.on('mousedown', (e: MouseEvent) => {
      const coords = this.getCoords(e, true);
      if (e.which === 3) {
        this._menuCoords = coords;
        this.updateMenuContext();
      } else {
        this._downCoords = coords;
        this.highlight();
      }
    });
    this.$grid.on('mouseup', (e: MouseEvent) => {
      e.stopImmediatePropagation();
      const upCoords = this.getCoords(e);
      this.highlight(upCoords);

      if (this._downCoords) {
        if (upCoords.x === this._downCoords.x && upCoords.y === this._downCoords.y) {
          if (upCoords.x != null && upCoords.y != null) {
            // cell
            let state: 0 | 1 | 2;
            switch (this._downCoords.which) {
              case 'left':
                state = ((this._downCoords.state + 1) % 3) as 0 | 1 | 2;
                break;
              case 'right':
                state = this._downCoords.state === 2 ? 0 : 2;
                break;
            }

            this.setState(this._downCoords, state);
          } else if (upCoords.x != null) this.showLabelModal('columns', upCoords.x);
          else if (upCoords.y != null) this.showLabelModal('rows', upCoords.y);
        }

        if (this._downCoords.pending) {
          this.addToHistory('paint', this._downCoords.snapshot);
        }

        this._downCoords = null;
      }
    });

    q(window).on('mouseup', () => {
      this._downCoords = null;
      this.clearContext(this._ctxLite);
    });

    this.$root.find('.drop-zone').on('dragover', (event) => event.preventDefault());
    this.$root.find('.drop-zone').on('drop', (event: DragEvent) => {
      event.preventDefault();
      this.read(event.dataTransfer.files[0]);
    });

    this.$root
      .appendIn(this._settingsPopup)
      .on('confirmaccept', () => console.log('handle settings change!'));

    this.$root
      .appendIn(this._historyPopup)
      .on('confirmaccept', () => console.log('handle history change!'));

    this.$root.appendIn(this._editLabelPopup).on('confirmaccept', () => this.receiveLabelUpdate());

    this.$root.appendIn(this._pixelsPopup).on('confirmaccept', () => {
      const prevGrid = this.toString();
      this.load(this._pixelsPopup.labelGrid);
      if (this.toString() !== prevGrid) {
        this.addToHistory('pixels', prevGrid);
      }
    });
  }

  /**
   * Draws a grid according to the grid data supplied.
   * @param grid The grid data.
   */
  load(grid: PlainGrid | DenseGrid | Point) {
    this._grid = XGrid.AsPlain(grid);
    this.refresh();
  }

  /** Removes all cell data, leaving the labels intact. */
  clear() {
    if (!this.isBlank) {
      this.addToHistory('clear-grid', this.toString());
      XGrid.WipeCells(this._grid);
      this.refresh();
    }
  }

  /** Provides a hint for the next solving action. */
  hint() {
    const result = Grid.load(this._grid).nextHint();
    console.log(result);
  }

  /** Attempts to solve the grid. */
  solve() {
    if (!this.isFull) {
      const result = Grid.load(this._grid).solve();
      if (result.solved) {
        console.log('Solved in ' + result.solvedMs + 'ms');
        this.addToHistory('solve', this.toString());
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
    const labels_w = Math.max(this._size * 2, (grid_w * 2) / 5);
    const labels_h = Math.max(this._size * 2, (grid_h * 2) / 5);

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
          config.gridSize.max
        );
        this.load(XGrid.AsPlain({ x: totalColumns, y: this.totalRows }));
        break;
      case 'rows':
        const totalRows = Griddler.Round(
          newValue,
          config.gridSize.default,
          config.gridSize.step,
          config.gridSize.min,
          config.gridSize.max
        );
        this.load(XGrid.AsPlain({ x: this.totalColumns, y: totalRows }));
        break;
      case 'size':
        this._size = Griddler.Round(
          newValue,
          config.cellSize.default * config.resolution,
          config.cellSize.step * config.resolution,
          config.cellSize.min * config.resolution,
          config.cellSize.max * config.resolution
        );
        break;
    }
  }

  private static Download(dataUrl: string, filename: string) {
    const tempLink = document.createElement('a');
    tempLink.href = dataUrl;
    tempLink.download = filename;
    tempLink.click();
  }

  private static Round(val: string | number, def: number, to: number, min: number, max: number) {
    val = parseInt(`${val}`);
    const rnd = to * Math.round((isNaN(val) ? def : val) / to);
    return Math.max(min, Math.min(max, rnd));
  }

  private read(file: File) {
    if (file == null) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const current = this.toString();
      const loaded = e.target.result as string;
      if (loaded !== current) {
        this.load(JSON.parse(loaded));
        this.addToHistory('load', current);
      }
    };
    reader.readAsText(file);
  }

  private addToHistory(type: string, grid: string): void {
    this._history.splice(this._historyIndex);
    this._historyIndex = this._history.push({
      date: new Date(),
      type,
      grid,
    });
  }

  private gotoHistory(newIndex: number): void {
    if (newIndex === this._historyIndex) return;
    const historyItem = this._history[newIndex];
    if (historyItem) {
      this._historyIndex = newIndex;
      this.load(JSON.parse(historyItem.grid));
    }
  }

  private undoOne(): void {
    if (this._historyIndex === this._history.length) {
      const curr = this.toString();
      if (curr !== this._history[this._historyIndex]?.grid) {
        this.addToHistory('undo', curr);
        this._historyIndex--;
      }
    }

    this.gotoHistory(this._historyIndex - 1);
  }

  private getState(point: Point): 0 | 1 | 2 {
    return point.x == null || point.y == null ? null : this._grid.rows[point.y].cells[point.x];
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
          case 1:
            this.setCell(point.x, point.y);
            break;
          case 2:
            this.markCell(point.x, point.y);
            break;
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
    const x0 = ci * this._size + Griddler.PIXEL_OFFSET + this._size / 2;
    const y0 = ri * this._size + Griddler.PIXEL_OFFSET + this._size / 2;
    this._ctxGrid.moveTo(x0, y0);
    this._ctxGrid.arc(x0, y0, this._size / 8, 0, 2 * Math.PI);
  }

  private setCell(ci: number, ri: number) {
    const buffer = 2 * Griddler.PIXEL_OFFSET;
    this._ctxGrid.rect(
      ci * this._size + buffer,
      ri * this._size + buffer,
      this._size - buffer,
      this._size - buffer
    );
  }

  private populate() {
    this.populateLabels();
    this.populateStates();
  }

  private populateLabels() {
    this._ctxGrid.font = `${this._fontSize}px Times New Roman`;
    this._ctxGrid.fillStyle = config.palette.label;

    const grid_w = this.totalColumns * this._size + Griddler.PIXEL_OFFSET;
    this._ctxGrid.clearRect(grid_w, 0, this.totalWidth, this.totalHeight);
    this._grid.rows
      .map((row, idx) => ({ labels: row.labels, idx }))
      .filter((set) => set.labels && set.labels.length > 0)
      .forEach((set) => this.setRowLabels(set.idx, set.labels, grid_w));

    const grid_h = this.totalRows * this._size + Griddler.PIXEL_OFFSET;
    this._ctxGrid.clearRect(0, grid_h, this.totalWidth, this.totalHeight);
    this._grid.columns
      .map((col, idx) => ({ labels: col.labels, idx }))
      .filter((set) => set.labels && set.labels.length > 0)
      .forEach((set) => this.setColumnLabels(set.idx, set.labels, grid_h));
  }

  private populateStates() {
    this._ctxGrid.beginPath();
    this._grid.rows
      .map((row, idx) => ({ cells: row.cells, idx }))
      .forEach((row) =>
        (row.cells || [])
          .map((state, idx) => ({ state, idx }))
          .forEach((cell) => {
            switch (cell.state) {
              case 1:
                this.setCell(cell.idx, row.idx);
                break;
              case 2:
                this.markCell(cell.idx, row.idx);
                break;
            }
          })
      );
    this._ctxGrid.fillStyle = config.palette.cells;
    this._ctxGrid.fill();
  }

  private setRowLabels(idx: number, labels: number[], grid_w?: number) {
    const isBulk = !!grid_w;
    grid_w = grid_w || this.totalColumns * this._size + Griddler.PIXEL_OFFSET;
    const x = grid_w + this._fontSize / 2;
    const y = idx * this._size + this._size / 2 + this._fontSize / 2;
    this._ctxGrid.textAlign = 'left';
    if (!isBulk) this._ctxGrid.clearRect(x, idx * this._size, this.totalWidth, this._size);
    this._ctxGrid.fillText(labels.join(' . '), x, y);
  }

  private setColumnLabels(idx: number, labels: number[], grid_h?: number) {
    const isBulk = !!grid_h;
    grid_h = grid_h || this.totalRows * this._size + Griddler.PIXEL_OFFSET;
    const x = idx * this._size + this._size / 2 + 2;
    this._ctxGrid.textAlign = 'center';
    if (!isBulk) this._ctxGrid.clearRect(idx * this._size, grid_h, this._size, this.totalHeight);
    labels.forEach((label, idx) => {
      this._ctxGrid.fillText(label + '', x, grid_h + this._fontSize * 1.2 * (idx + 1.2));
    });
  }

  private clearContext(context: CanvasRenderingContext2D) {
    context.clearRect(0, 0, this.totalWidth, this.totalHeight);
  }

  private getCoords(
    locator: { offsetX: number; offsetY: number; which: number },
    snapshot = false
  ): GridContextPoint {
    const ci = Griddler.Round(
      (locator.offsetX * config.resolution) / this._size,
      0,
      1,
      0,
      this.totalColumns
    );
    const ri = Griddler.Round(
      (locator.offsetY * config.resolution) / this._size,
      0,
      1,
      0,
      this.totalRows
    );
    const dims = {
      x: ci === this.totalColumns ? null : ci,
      y: ri === this.totalRows ? null : ri,
    };
    return {
      ...dims,
      x0: dims.x * this._size + Griddler.PIXEL_OFFSET,
      y0: dims.y * this._size + Griddler.PIXEL_OFFSET,
      which: locator.which === 1 ? 'left' : locator.which === 0 ? null : 'right',
      state: this.getState(dims),
      snapshot: snapshot ? this.toString() : null,
    };
  }

  private getShade(state: number): string {
    switch (state) {
      case -1:
        return config.hilite.default;
      case 2:
        return config.hilite.marking;
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
        this._size - 2 * buffer
      );
    }
  }

  private showHistoryModal() {
    this._historyPopup.historyItems = this._history;
    this._historyPopup.historyIndex = this._historyIndex;
    this._historyPopup.open();
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
      this.addToHistory('label', this.toString());
      set.labels = next;
      if (type === 'rows') this.setRowLabels(index, next);
      else this.setColumnLabels(index, next);
    }
  }

  private handleMenuEvents() {
    this.$menu.on('menuopen', () => setTimeout(() => this.highlight(this._menuCoords)));
    this.$menu.on('mouseup', (e) => e.stopPropagation());
    this.$menu.on('mouseleave', () => this.clearContext(this._ctxLite));

    this.$menu.on('itemhover', (e: CustomEvent) => {
      const setNode = (e.detail.origin as HTMLElement).closest('li.set[id]');
      if (setNode && setNode.classList.contains('set')) {
        const coordsClone = JSON.parse(JSON.stringify(this._menuCoords)) as GridContextPoint;
        const setType = setNode.id as 'columns' | 'rows';
        if (setType == 'rows') delete coordsClone.x;
        else delete coordsClone.y;
        this.highlight(coordsClone);
      } else {
        this.highlight(this._menuCoords);
      }
    });

    // Handler for methods sensitive to the cell reference
    this.$menu.on('itemselect', (e: CustomEvent) => {
      const item = e.detail.origin as Element;
      if (item.matches('.set li')) {
        const setType = item.closest('.set').id as 'columns' | 'rows';
        const setIndex = setType == 'rows' ? this._menuCoords.y : this._menuCoords.x;

        if (item.matches('.labels .edit')) {
          this.showLabelModal(setType, setIndex);
        } else if (item.matches('.labels .clear')) {
          const set = this._grid[setType][setIndex];
          const empty = [] as number[];
          if (empty.join(',') !== set.labels.join(',')) {
            this.addToHistory('label', this.toString());
            set.labels = empty;
            if (setType === 'rows') this.setRowLabels(setIndex, empty);
            else this.setColumnLabels(setIndex, empty);
          }
        }
      }
    });

    this.$menu.find('#changes .undo').on('click', () => this.undoOne());
    this.$menu.find('#changes .redo').on('click', () => this.gotoHistory(this._historyIndex + 1));
    this.$menu.find('#changes .history').on('click', () => this.showHistoryModal());

    this.$menu.find('#grid .hint').on('click', () => this.hint());
    this.$menu.find('#grid .solve').on('click', () => this.solve());
    this.$menu.find('#grid .clear-grid').on('click', () => this.clear());
    this.$menu.find('#grid .labels .spawn').on('click', () => {
      XGrid.ScrapeLabels(this._grid);
      this.populateLabels();
      if (this._menuCoords.snapshot !== this.toString()) {
        this.addToHistory('spawn', this._menuCoords.snapshot);
      }
    });
    this.$menu.find('#grid .labels .clear').on('click', () => {
      XGrid.WipeLabels(this._grid);
      this.populateLabels();
      if (this._menuCoords.snapshot !== this.toString()) {
        this.addToHistory('clear-labels', this._menuCoords.snapshot);
      }
    });

    const fileElem = this.$menu.find('#import .json > [type=file]').get(0);
    this.$menu.find('#import .json').on('click', () => (fileElem as HTMLElement).click());
    this.$menu.find('#import .pixel').on('click', () => this._pixelsPopup.open());

    this.$menu
      .find('#export .json')
      .on('click', () => Griddler.Download(this.textDataUrl, 'grid.json'));
    this.$menu
      .find('#export .image')
      .on('click', () => Griddler.Download(this.imageDataUrl, 'grid.png'));
    this.$menu.find('#export .print').on('click', () => window.print());

    this.$menu.find('#settings').on('click', () => this._settingsPopup.open());
  }

  private updateMenuContext() {
    const coords = this._menuCoords;

    this.$menu
      .first('#columns')
      .toggle('hidden', coords.x == null)
      .first('p')
      .empty()
      .append(`<span>Column ${coords.x + 1}</span>`);

    this.$menu
      .first('#rows')
      .toggle('hidden', coords.y == null)
      .first('p')
      .empty()
      .append(`<span>Row ${coords.y + 1}</span>`);

    this.$menu
      .first('#cell')
      .toggle('hidden', coords.x == null || coords.y == null)
      .first('p')
      .empty()
      .append(`<span>Cell (${coords.x + 1}, ${coords.y + 1})</span>`);

    this.$menu.first('#changes .undo').toggle('disabled', this._historyIndex <= 0);
    this.$menu
      .first('#changes .redo')
      .toggle('disabled', this._historyIndex >= this._history.length - 1);
    this.$menu.first('#changes .history').toggle('disabled', !this._history?.length);
    this.$menu.first('#changes').toggle('disabled', (e) => !e.querySelector('li:not(.disabled)'));

    this.$menu.first('#grid .hint').toggle('disabled', this.isFull);
    this.$menu.first('#grid .solve').toggle('disabled', this.isFull);
    this.$menu.first('#grid .clear-grid').toggle('disabled', this.isBlank);
    this.$menu.first('#grid .labels .spawn').toggle('disabled', this.isBlank);
    this.$menu.first('#grid .labels .clear').toggle('disabled', !this.anyLabels);

    this.$menu.find('.set .labels .clear').toggle('disabled', (e) => {
      const set =
        e.closest('.set').id == 'rows' ? this._grid.rows[coords.y] : this._grid.columns[coords.x];
      return !set?.labels?.length;
    });

    // Reload for changes into shadow DOM
    (this.$menu.get(0) as ContextMenu).reload();
  }
}

export { ContextMenu };
