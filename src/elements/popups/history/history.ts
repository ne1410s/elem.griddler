import { GriddlerPopupBase } from '../base/griddler-popup';
import { GridEditHistory } from '../../../models/meta';
import markupUrl from './history.html';

export class HistoryPopup extends GriddlerPopupBase {

  historyItems: GridEditHistory[];
  historyIndex: number;

  constructor() {
    super(markupUrl);

    // ...
  }

  protected renderZone() {
    // ...
  }

  protected onOpen() {
    // ...
    console.log(this.historyItems);
    console.log(this.historyIndex);
  }

  protected validate(): boolean {
    // ...
    return true;
  }
}