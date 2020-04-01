import { q, ChainedQuery } from '@ne1410s/dom';
import { Popup } from '@ne1410s/popup';

import markupUrl from './griddler-popup.html';
import stylesUrl from './griddler-popup.css';

export abstract class GriddlerPopupBase extends Popup {

  protected $body: ChainedQuery;
  private $zone: ChainedQuery;
  private dirty: boolean;

  constructor(
      move = true,
      resize = true) {
        
    super();

    if (move) q(this).attr('move', '');
    if (resize) q(this).attr('resize', '');

    q(this).on('open', () => this.reset());

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
    this.dirty = false;
    this.renderZone();
    this.validate();
    if (!this.canShrink) this.fixMinSize();
  }

  protected abstract renderZone(): void;

  protected abstract validate(): boolean;
}