import { Griddler } from './griddler/griddler';
if (window.customElements && !window.customElements.get('ne14-grid')) {
  window.customElements.define('ne14-grid', Griddler);
}