import { GriddlerPopupBase } from '../base/griddler-popup';

export class PixelsPopup extends GriddlerPopupBase {

  constructor() {
    super();
    this.titleText = 'Pixels';
    // ...
  }

  protected renderZone() {
    // ...
  }

  protected validate(): boolean {
    // ...
    return true;
  }
}