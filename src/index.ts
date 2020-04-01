import { SettingsPopup } from './elements/popups/settings/settings';
import { HistoryPopup } from './elements/popups/history/history';
import { EditLabelPopup } from './elements/popups/edit-label/edit-label';
import { Griddler } from './elements/griddler/griddler';

if ('customElements' in window) {
  window.customElements.define('ne14-pop-settings', SettingsPopup);
  window.customElements.define('ne14-pop-history', HistoryPopup);
  window.customElements.define('ne14-pop-edit-label', EditLabelPopup);
  window.customElements.define('ne14-grid', Griddler);
}

export { Griddler };