import { q, ChainedQuery } from '@ne1410s/dom';
import { Popup } from '@ne1410s/popup';

import markupUrl from './edit-label.html';
import stylesUrl from './edit-label.css';

export class EditLabelPopup extends Popup {

  setType: 'columns' | 'rows';
  setIndex: number;
  capacity: number;
  labels: number[];
  
  private $zone: ChainedQuery;

  dirty: boolean = true; // todo: implement!

  constructor() {
    super();

    q(this)
      .attr('move', '')
      .attr('resize', '')
      .append(this.decode(markupUrl))
      .append({ tag: 'style', text: this.decode(stylesUrl) })
      .on('open', () => this.onOpen());
    
    q(this).first('#btnCancel').on('click', () => this.dismiss());
    q(this).first('#btnSave').on('click', () => this.confirm());

    this.confirmCallback = () => this.validate();
    this.dismissCallback = () => !this.dirty || window.confirm('Abandon changes?');

    this.$zone = q(this).first('#labels');
  }

  onOpen() {
    this.setTitle();
    this.setLabels();
  }

  private setTitle() {
    const typeName = this.setType === 'columns' ? 'Column' : 'Row';
    const title = `${typeName} ${this.setIndex + 1}`;
    q(this).first('#title').elements[0].textContent = title;
  }

  private setLabels() {
    this.$zone.empty();
    this.labels.forEach(val => this.addLabel(val));
  }

  private addLabel(value?: number) {
    this.$zone.append({ tag: 'input', attr: {
      type: 'number',
      value: `${value}`,
      min: '0', max: `${this.capacity}` }
    });
  }

  private validate(): boolean {
    const inputs = this.$zone.find('input').elements
      .map(el => parseInt((el as HTMLInputElement).value))
      .filter(val => val);
    const total = inputs.reduce((acc, cur) => acc += cur, inputs.length - 1);
    
    //console.log('Inputs:', inputs, 'Count:', total, 'Capacity:', this.capacity);

    const valid = total <= this.capacity;
    if (valid) {
      this.labels = inputs;
    }
    // TODO: Error message(s)...

    return valid;
  }
}