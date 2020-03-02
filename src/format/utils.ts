export class Utils {

  /** Returns a new array of the specified size filled with the specified value. */
  public static FillArray<T>(size: number, valuer: () => T): T[] {
    const retVal = new Array(size);
    for (let i = 0; i < size; i++) { retVal[i] = valuer(); }
    return retVal;
  }

  /** Pools multiple events, firing once per delay cycle. */
  public static Throttle<T>(func: (arg: T) => void, delay = 200): (arg: T) => void {
    let active: boolean;
    return function (args) {
      if (!active) {
        if (active == null) func.call(this, args);
        active = true;
        const that = this;
        setTimeout(() => { 
          active = !!func.call(that, args);
          setTimeout(() => active = active || null, delay / 10);
        }, delay);
      }
    };
  }

  /** Pools multiple events, firing once after the delay period. */
  public static Debounce<T>(func: (arg: T) => void, delay = 200): (arg: T) => void {
    let timeout: NodeJS.Timeout;
    return function (arg) {
      clearTimeout(timeout);
      const that = this;
      timeout = setTimeout(() => func.call(that, arg), delay);
    };
  }
}