import { Pxl8r } from '@ne1410s/pxl8r';
import { GriddlerPopupBase } from '../base/griddler-popup';
import { PlainGrid, XGrid } from '../../../models/grid';
import markupUrl from './pixels.html';
import stylesUrl from './pixels.css';
import { Grid } from '../../../solve/grid';

export class PixelsPopup extends GriddlerPopupBase {

  private renderData: ImageData;

  public get plainGrid(): PlainGrid {
    return this.renderData ? XGrid.AsPlain(this.renderData) : null;
  }

  public get labelGrid(): PlainGrid {
    const grid = this.plainGrid;
    if (grid != null) {
      XGrid.ScrapeLabels(grid);
      XGrid.WipeCells(grid);
    }

    return grid;
  }

  constructor() { 

    super(markupUrl, stylesUrl);

    this.titleText = 'Pixels';
    this.$zone.first('ne14-pxl8r')
      .on('render', (e: CustomEvent) => this.renderData = e.detail);
  }

  protected renderZone() {
    //...
  }

  protected validate(): boolean {
    const test = this.labelGrid;
    let retVal = false;
    if (test != null) {
      const result = Grid.load(test).solve();
      if (!result.solved) {
        // TODO: Feedback for UI - e.g. cell state
        console.warn('Feed this back:', result);
      }

      retVal = result.solved;
    }

    return retVal;
  }
}

// Needs to be exported at some level
export { Pxl8r };