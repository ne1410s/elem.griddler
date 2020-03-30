import { q } from '@ne1410s/dom';
import { Popup } from '@ne1410s/popup';

import markupUrl from './edit-label.html';
import stylesUrl from './edit-label.css';

export class EditLabelPopup extends Popup {

  get title(): string { return q(this).first('#title').elements[0].textContent; }
  set title(value: string) { q(this).first('#title').elements[0].textContent = value; }

  labels: number[];  

  constructor() {
    super();

    q(this)
      .attr('move', '')
      .attr('resize', '')
      .append(this.decode(markupUrl))
      .append({ tag: 'style', text: this.decode(stylesUrl) })
      .on('open', () => {
        console.log('opening!!');
      })
    
  }
}