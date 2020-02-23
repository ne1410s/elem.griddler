export class Utils {

  /** Returns a new array of the specified size filled with the specified value. */
  public static fillArray<T>(size: number, valuer: () => T): T[] {
    const retVal = new Array(size);
    for (let i = 0; i < size; i++) { retVal[i] = valuer(); }
    return retVal;
  }
}