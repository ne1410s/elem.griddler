import { GriddlerPopupBase } from '../base/griddler-popup';

export class EditLabelPopup extends GriddlerPopupBase {
  
  setType: 'columns' | 'rows';
  setIndex: number;
  capacity: number;
  labels: number[];

  constructor() {
    super();
  }

  private get grace(): number { return this.capacity / 5; }

  protected renderZone() {
    const typeName = this.setType === 'columns' ? 'Column' : 'Row';
    this.titleText = `${typeName} ${this.setIndex + 1}`;

    this.$zone.empty();
    const minBoxes = Math.max(this.labels.length + 1, this.grace);
    for (let i = 0; i < minBoxes; i++) {
      this.addLabel(this.labels[i]);
    }
  }
  
  protected validate(): boolean {
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

  private onLabelInput() {
    this.dirty = true;
    this.validate();
  }
}