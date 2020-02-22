export class Label {

  /** Gets the minimum total size for a set of separated values. */
  public static minSize(values: number[]): number {
    return values.reduce((tot, curr) => {
      return tot > 0 ? curr + tot + 1 : curr + tot;
    }, 0);
  }

  public earliest: number;
  public latest: number;
  public readonly indexRef: string;

  constructor(
    public readonly value: number,
    public readonly index: number) {
    this.indexRef = `L${this.index}`;
  }
}

export class LabelSetLink {
  constructor(
    public readonly labelIndex: number,
    public readonly setIndex: number,
    public known: boolean) { }
}