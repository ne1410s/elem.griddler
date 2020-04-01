import { q, ChainedQuery } from '@ne1410s/dom';
import { Popup } from '@ne1410s/popup';

import markupUrl from './settings.html';
import stylesUrl from './settings.css';

export class SettingsPopup extends Popup {

  private $body: ChainedQuery;
  private $zone: ChainedQuery;
  private dirty: boolean;

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
    this.dirty = false;
    this.renderZone();
    this.validate();
    if (!this.canShrink) this.fixMinSize();
  }

  private renderZone() {

  }

  private validate(): boolean {
    return true;
  }
}