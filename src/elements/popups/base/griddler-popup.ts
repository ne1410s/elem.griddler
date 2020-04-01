import { q, ChainedQuery } from '@ne1410s/dom';
import { Popup } from '@ne1410s/popup';

import markupUrl from './griddler-popup.html';
import stylesUrl from './griddler-popup.css';

export abstract class GriddlerPopupBase extends Popup {
  
  protected abstract renderZone(): void;
  protected abstract validate(): boolean;

  protected $zone: ChainedQuery;
  protected $body: ChainedQuery;
  protected dirty: boolean;
  protected onOpen() {}

  constructor(move = true, resize = true) {       
    super();

    if (move) q(this).attr('move', '');
    if (resize) q(this).attr('resize', '');

    q(this).on('open', () => this.onOpenInternal());

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

  protected set titleText(value: string) {
    this.$body.first('#title').elements[0].textContent = value;
  }

  protected set errors(value: string[]) {
    const $err = this.$body.first('#errors').empty();
    if (value.length > 0) {
      const $list = $err.appendIn({tag: 'ul'});
      value.forEach(it => $list.append({tag: 'li', text: it}));
    }

    if (!this.canShrink) this.fixMinSize();
  }

  private onOpenInternal() {
    this.dirty = false;
    this.onOpen();
    this.renderZone();
    this.validate();
  }
}