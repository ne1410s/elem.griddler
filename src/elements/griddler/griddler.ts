import { CustomElementBase } from '@ne1410s/cust-elems';
import markupUrl from './griddler.html';
import stylesUrl from './griddler.css';

export class Griddler extends CustomElementBase {
  
  // static observedAttributes = ['open'];

  constructor() {
    super(stylesUrl, markupUrl);
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    // ...
  }

  connectedCallback() {}
  disconnectedCallback() {}
}