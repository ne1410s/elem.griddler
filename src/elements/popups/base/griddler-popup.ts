import { q, ChainedQuery } from '@ne1410s/dom';
import { Popup } from '@ne1410s/popup';

import markupUrl from './griddler-popup.html';
import stylesUrl from './griddler-popup.css';
import { QuickParam } from '@ne1410s/dom/dist/models';

export abstract class GriddlerPopupBase extends Popup {
  
  protected abstract renderZone(): void;
  protected abstract validate(): boolean;

  protected $zone: ChainedQuery;
  protected $body: ChainedQuery;
  protected dirty: boolean;
  protected onOpen() {}

  constructor(
      zoneMarkupUrl?: string,
      moreStylesUrl?: string,
      move = true,
      resize = true) {  

    super();

    if (move) q(this).attr('move', '');
    if (resize) q(this).attr('resize', '');

    q(this).on('open', () => this.onOpenInternal());

    const styleTagParams: QuickParam[] = [{ tag: 'style', text: this.decode(stylesUrl) }];
    if (moreStylesUrl) styleTagParams.push({ tag: 'style', text: this.decode(moreStylesUrl) });

    this.$body = q(this.root)
      .find('.fore')
      .append(this.decode(markupUrl))
      .append(...styleTagParams)
      .find('.body');

    this.$body.first('#btnCancel').on('click', () => this.dismiss());
    this.$body.first('#btnSave').on('click', () => this.confirm());

    this.$zone = this.$body.first('#zone');
    if (zoneMarkupUrl) {
      this.$zone.append(this.decode(zoneMarkupUrl));
    }

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