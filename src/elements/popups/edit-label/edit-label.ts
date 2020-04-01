import { q, ChainedQuery } from '@ne1410s/dom';
import { Popup } from '@ne1410s/popup';

import markupUrl from './edit-label.html';
import stylesUrl from './edit-label.css';

export class EditLabelPopup extends Popup {
  
  setType: 'columns' | 'rows';
  setIndex: number;
  capacity: number;
  labels: number[];
    
  private $body: ChainedQuery;
  private $zone: ChainedQuery;
  private dirty: boolean;
  private get grace(): number { return this.capacity / 5; }
  
  private set titleText(value: string) {
    this.$body.first('#title').elements[0].textContent = value;
  }

  private set errors(value: string[]) {
    const $err = this.$body.first('#errors').empty();
    if (value.length > 0) {
      const $list = $err.append({tag: 'ul'}).first('ul');
      value.forEach(it => $list.append({tag: 'li', text: it}));
    }

    if (!this.canShrink) this.fixMinSize();
  }
      
  constructor() {
    super();

    q(this)
      .attr('move', '')
      .attr('resize', '')
      .on('open', () => this.reset());

    this.$body = q(this.root)
      .find('.fore')
      .append(this.decode(markupUrl))
      .append({tag: 'style', text: this.decode(stylesUrl)})
      .find('.body');
      
    this.$zone = this.$body.first('#zone');
    this.$body.first('#btnCancel').on('click', () => this.dismiss());
    this.$body.first('#btnSave').on('click', () => this.confirm());

    this.confirmCallback = () => this.validate();
    this.dismissCallback = () => !this.dirty || window.confirm('Abandon changes?');
  }

  private reset() {
    const typeName = this.setType === 'columns' ? 'Column' : 'Row';
    this.titleText = `${typeName} ${this.setIndex + 1}`;
    this.dirty = false;
    this.renderZone();
    this.validate();
    if (!this.canShrink) this.fixMinSize();
  }

  private renderZone() {
    this.$zone.empty();
    const minBoxes = Math.max(this.labels.length + 1, this.grace);
    for (let i = 0; i < minBoxes; i++) {
      this.addLabel(this.labels[i]);
    }
  }

  private addLabel(value?: number) {
    this.$zone.append({ 
      tag: 'input',
      evts: { input: () => this.onLabelInput() },
      attr: {
        type: 'number',
        value: value ? `${value}` : '',
        min: '0', max: `${this.capacity}`
      },
    });
  }

  private validate(): boolean {

    const ranged = this.$zone.find('input').elements.reduce((acc, cur) => {
      const val = parseInt((cur as HTMLInputElement).value);
      cur.className = '';
      if (val) {
        if (acc.tot) acc.tot++;
        acc.tot += val;
        acc.res.push(val);
        cur.className = acc.tot > this.capacity ? 'err' : '';
      }

      return acc;
    }, { tot: 0, res: [] as number[], err: [] as string[] });

    const diff = ranged.tot - this.capacity;
    if (diff > 0) {
      ranged.err.unshift(`${ranged.tot} is ${diff} too many! (max: ${this.capacity})`);
    }

    this.labels = ranged.res;
    this.errors = ranged.err;
    const valid = ranged.err.length === 0;
    const btnSave = this.$body.first('#btnSave').elements[0] as HTMLInputElement;
    btnSave.disabled = !valid;
    return valid;
  }

  private onLabelInput() {
    this.dirty = true;
    this.validate();
  }
}