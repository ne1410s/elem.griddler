import { GriddlerPopupBase } from '../base/griddler-popup';

export class SettingsPopup extends GriddlerPopupBase {

  constructor() {
    super();
    this.titleText = 'Settings';
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