import { Griddler } from './elements/griddler/griddler';
import { SettingsPopup } from './elements/popups/settings/settings';
import { HistoryPopup } from './elements/popups/history/history';
import { EditLabelPopup } from './elements/popups/edit-label/edit-label';
import { PixelsPopup } from './elements/popups/pixels/pixels';

if ('customElements' in window) {
  window.customElements.define('ne14-grid-pop-settings', SettingsPopup);
  window.customElements.define('ne14-grid-pop-history', HistoryPopup);
  window.customElements.define('ne14-grid-pop-edit-label', EditLabelPopup);
  window.customElements.define('ne14-grid-pop-pixels', PixelsPopup);
  window.customElements.define('ne14-grid', Griddler);
}

export { Griddler };