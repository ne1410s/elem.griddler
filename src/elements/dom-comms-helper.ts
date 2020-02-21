export abstract class DomCommsHelper {

  public static Throttle(
      callback: (event: Event) => void,
      delay: number = 200): (event: Event) => void {
    
    const ref = this;
    let throttleTimeout: NodeJS.Timeout;
    let storedEvent: Event;
  
    const throttledEventHandler = (event: Event) => {  
      storedEvent = event;
      const shouldHandleEvent = !throttleTimeout;
      if (shouldHandleEvent) {
        callback.call(ref, storedEvent);
        storedEvent = null;
        throttleTimeout = setTimeout(() => {
          throttleTimeout = null;
          if (storedEvent) {
            throttledEventHandler(storedEvent);
          }
        }, delay);
      }
    };
  
    return throttledEventHandler;
  }

  
  public static Debounce(
      callback: (event: Event) => void,
      delay = 200,
      immediate = false): (event: Event) => void {

    const ref = this;
    let debounceTimeout: NodeJS.Timeout;
    const debouncedEventHandler = (event: Event) => {
      const later = () => {
        debounceTimeout = null;
        if (!immediate) {
          callback.call(ref, event);
        }
      };

      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(later, delay);
      if (immediate && !debounceTimeout) { 
        callback.call(ref, event);
      }
    };

    return debouncedEventHandler;
  };
}