import { Pxl8r } from '@ne1410s/pxl8r';
import { GriddlerPopupBase } from '../base/griddler-popup';
import { PlainGrid } from '../../../models/grid';
import markupUrl from './pixels.html';
import stylesUrl from './pixels.css';

export class PixelsPopup extends GriddlerPopupBase {

  private renderData: ImageData;

  public get asGrid(): PlainGrid {
    // TODO: Map the renderData into a plain ol grid and return it..
    return null;
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
    const freshGrid = this.asGrid;
    // TODO: Return whether fresh grid is solvable or not!
    return true;
  }
}

// Needs to be exported at some level
export { Pxl8r };