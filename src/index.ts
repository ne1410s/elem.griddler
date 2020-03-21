import { Griddler } from './elements/griddler/griddler';

if ('customElements' in window) {
  window.customElements.define('ne14-grid', Griddler);
}

export { Griddler };