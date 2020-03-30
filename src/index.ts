import { Griddler } from './elements/griddler/griddler';
import { EditLabelPopup } from './elements/popups/edit-label/edit-label';

if ('customElements' in window) {
  window.customElements.define('ne14-grid', Griddler);
  window.customElements.define('ne14-pop-edit-label', EditLabelPopup);
}

export { Griddler };