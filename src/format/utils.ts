export class Utils {

  /** Returns a new array of the specified size filled with the specified value. */
  public static FillArray<T>(size: number, valuer: () => T): T[] {
    const retVal = new Array(size);
    for (let i = 0; i < size; i++) { retVal[i] = valuer(); }
    return retVal;
  }

  /** Pools multiple events, firing once per delay cycle. */
  public static Throttle<E, T extends (event: E) => void>(func: T, delay = 200): void {
    
    const timer = setTimeout(() => {
      return func;
    }, delay);


    
  }

  /** Pools multiple events, firing once after the delay period. */
  public static Debounce<E, T extends (event: E) => void>(func: T, delay = 200): T {
    
    return func;
  }
}