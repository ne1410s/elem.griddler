import { Pxl8r } from '@ne1410s/pxl8r';
import { GriddlerPopupBase } from '../base/griddler-popup';
import { PlainGrid, XGrid } from '../../../models/grid';
import markupUrl from './pixels.html';
import stylesUrl from './pixels.css';
import { Grid } from '../../../solve/grid';
import { Utils } from '../../../utils';

export class PixelsPopup extends GriddlerPopupBase {
  private _labelGrid: PlainGrid;
  public get labelGrid(): PlainGrid {
    return this._labelGrid;
  }

  private pxl8r: Pxl8r;
  private renderData: ImageData;

  constructor() {
    super(markupUrl, stylesUrl);

    this.titleText = 'Pixels';
    this.pxl8r = this.$zone
      .first('ne14-pxl8r')
      .on(
        'render',
        Utils.Debounce((e: CustomEvent) => this.onControlRender(e), 100)
      )
      .get(0) as Pxl8r;
  }

  protected renderZone() {
    // ...
  }

  protected validate = () => this.visualTest();

  private onControlRender(event: CustomEvent) {
    this.renderData = event.detail;
    this._labelGrid = XGrid.AsPlain(this.renderData);
    XGrid.ScrapeLabels(this._labelGrid);
    XGrid.WipeCells(this._labelGrid);
    this.visualTest();
  }

  private visualTest(): boolean {
    let retVal = false;
    if (this._labelGrid != null) {
      const result = Grid.load(this._labelGrid).solve();
      retVal = result.solved;
      XGrid.OverlayResult(this.renderData, result);
      this.pxl8r.overlay(this.renderData);
    }

    return retVal;
  }
}

// Needs to be exported at some level
export { Pxl8r };
