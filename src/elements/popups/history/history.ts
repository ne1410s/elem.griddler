import { q } from '@ne1410s/dom';
import { GriddlerPopupBase } from '../base/griddler-popup';
import { GridEditHistory } from '../../../models/meta';

import markupUrl from './history.html';
import stylesUrl from './history.css';

export class HistoryPopup extends GriddlerPopupBase {

  historyItems: GridEditHistory[];
  historyIndex: number;

  constructor() {
    super(markupUrl, stylesUrl);
    this.titleText = 'Change History';
  }

  protected renderZone() {
    
    const $table = this.$zone 
      .first('.table')
      .empty()
      .append('<div class="header row"><p>Type</p><p>Date</p></div>');

    this.historyItems.forEach((item, i) => {
      $table
        .appendIn(`<div><p>${item.type}</p><p>${item.date}</p></div>`)
        .attr('class', i === this.historyIndex ? 'selected row' : 'row');
    });
  }

  protected validate(): boolean {
    // ...
    return true;
  }
}