import { Pxl8r } from '@ne1410s/pxl8r';
import { GriddlerPopupBase } from '../base/griddler-popup';

export class PixelsPopup extends GriddlerPopupBase {

  pixelsX: number = 35;
  private pxl8r: Pxl8r;

  constructor() {
    super();
    this.titleText = 'Pixels';
  }

  protected renderZone() {
    this.$zone.empty();
    this.pxl8r = document.createElement('ne14-pxl8r') as Pxl8r;

    console.log(window.customElements.get('ne14-pxl8r'));
    console.log(window.customElements.get('ne14-pop'));

    this.pxl8r.resolution = this.pixelsX;
    this.pxl8r.filter = 'bw';
    this.pxl8r.addEventListener('render', (e: CustomEvent) => this.onRender(e));
    this.$zone.append(this.pxl8r);
  }

  protected validate(): boolean {
    // ...
    // TODO: Map data from pxl8r into grid
    // TODO: Return whether this is solvable or not!
    return true;
  }

  private onRender(e: CustomEvent) {
    console.log('on render :) Detail:', e.detail);
  }
}