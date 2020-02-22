import { CellSetBase, LabelSetLink, BlockSet, Label, SpaceSet, SetType, CellState } from "./models";

/** A complete set of cells - representing a column or row. */
export class FullSet extends CellSetBase {

  public labelSpaceMap: LabelSetLink[] = [];
  public labelBlockMap: LabelSetLink[] = [];
  public readonly spaces: SpaceSet[] = [];
  public readonly blocks: BlockSet[] = [];
  public readonly labels: Label[];
  public readonly indexRef: string;
  public readonly altType: SetType;

  public get stateRef(): string {
    return `${this.cells.map(state => String.fromCharCode(state)).join('')}`;
  }

  public get consoleRef(): string {
    return `${this.indexRef}: ${this.stateRef} ${this.labelRef}`;
  }

  public get labelRef(): string {
    return this.labels.map(l => l.value).join('.');
  }

  public get labelsRef(): string {
    return this.labels.map((l, i) => this.getLabelRef(i)).join(' / ');
  }

  public get solved(): boolean {
    return !this.cells.some(state => state === CellState.Blank);
  }

  constructor(
    public readonly start: number,
    public readonly type: SetType,
    public readonly index: number,
    public readonly cells: CellState[],
    labelValues: number[]) {
    super(start, type, index, cells.length);
    this.altType = this.type === SetType.Row ? SetType.Column : SetType.Row;
    this.labels = labelValues.map((v, i) => new Label(v, i));
    this.indexRef = `${SetType[this.type].substr(0, 3)} ${this.index}`;
    this.performCellPass(true);
    this.performCellPass(false);
    this.setLabelSpaces();
    this.setLabelBlocks();

    let linksChanged: boolean;
    do {
      linksChanged = this.updateMaps();
      this.applyBlockValueRanges();
      linksChanged = linksChanged || this.applyBlockPositionRanges();
      linksChanged = linksChanged || this.applyDistinctBlockPairing();
    } while (linksChanged);
  }

  /** Marks and fills all appropriate blocks, returning indices of the mark and fill cells. */
  public solve(): { marks: number[], fills: number[] } {

    const blanx = this.cells.map((cell, idx) => ({ c: cell, i: idx })).filter(ic => ic.c === CellState.Blank);
    const mIdx = this.labels.reduce((ac, l) =>
      ac.filter(ib => ib.i < l.earliest || ib.i > l.latest), blanx).map(mark => mark.i);
    const fIdx = this.labels.reduce((ac, l) =>
      ac.concat(blanx.filter(ib => ib.i < l.earliest + l.value && ib.i > l.latest - l.value)),
      [] as Array<{ c: CellState, i: number }>).map(fill => fill.i);

    this.blocks // Add fills for edged-out blocks
      .filter(b => b.rightEdge !== b.end || b.leftEdge !== b.start)
      .forEach(b => blanx.filter(ic => ic.i >= b.leftEdge && ic.i <= b.rightEdge).forEach(ci => fIdx.push(ci.i)));

    this.blocks // Add marks to blocks at their maximum
      .filter(b => 1 + b.rightEdge - b.leftEdge === b.maxSize)
      .forEach(b => { mIdx.push(b.leftEdge - 1); mIdx.push(b.rightEdge + 1); });

    const mIdxFilt = blanx // mIdx was originally a Set to prevent duplicates, but array means es5.
      .filter(ic => mIdx.indexOf(ic.i) !== -1)
      .map(ic => ic.i).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);

    const fIdxFilt = blanx // fIdx was originally a Set to prevent duplicates; but array means es5.
      .filter(ic => fIdx.indexOf(ic.i) !== -1)
      .map(ic => ic.i).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);

    mIdxFilt.forEach(mInd => this.cells[mInd] = CellState.Marked);
    fIdxFilt.forEach(fInd => this.cells[fInd] = CellState.Filled);
    return { marks: mIdxFilt, fills: fIdxFilt };
  }

  public getLabelRef(index: number): string {
    const label = this.labels[index];
    const sLinks = this.getLinksForLabel(index, true).map(sl => sl.setIndex + (sl.known ? 'K' : 'M'));
    const bLinks = this.getLinksForLabel(index, false).map(bl => bl.setIndex + (bl.known ? 'K' : 'M'));
    return `${label.indexRef}: R=${label.earliest}-${label.latest} S=${sLinks} B=${bLinks}`;
  }

  private getLinksForLabel(lIndex: number, forSpace: boolean): LabelSetLink[] {
    return (forSpace ? this.labelSpaceMap : this.labelBlockMap)
      .filter(mi => mi.labelIndex === lIndex);
  }

  private getLinksForSet(setIndex: number, forSpace: boolean): LabelSetLink[] {
    return (forSpace ? this.labelSpaceMap : this.labelBlockMap)
      .filter(mi => mi.setIndex === setIndex);
  }

  private deleteLink(lIndex: number, setIndex: number, forSpace: boolean): void {
    const mapName = forSpace ? 'labelSpaceMap' : 'labelBlockMap';
    this[mapName] = this[mapName].filter(mi => mi.labelIndex !== lIndex || mi.setIndex !== setIndex);
  }

  private upsertLink(lIndex: number, setIndex: number, forSpace: boolean, known: boolean): void {
    const map = forSpace ? this.labelSpaceMap : this.labelBlockMap;
    const mapItems = map.filter(mi => mi.labelIndex === lIndex && mi.setIndex === setIndex);
    if (mapItems.length === 1) { mapItems[0].known = known; }
    else { map.push(new LabelSetLink(lIndex, setIndex, known)); }
  }

  private upsertLinks<T extends CellSetBase>(lIndex: number, forSpace: boolean, sets: T[], known: boolean): void {
    sets.forEach(set => this.upsertLink(lIndex, set.index, forSpace, known));
  }

  /**
  * Iterates cells in a particular direction. The forward pass sets spaces and blocks for the
  * set as well as earliest label positions. The backward pass sets labels latest positions only.
  * NB: This method is not reasonably capable of managing block-block interactions.
  */
  private performCellPass(forwards: boolean): void {
    let spaceStart = -1;
    let blockStart = -1;
    let blockIndex = -1;
    let labelStart = -1;
    let blocks: BlockSet[] = [];
    let labelIndex = forwards ? 0 : this.labels.length - 1;

    const allCells = forwards ? this.cells.slice(0) : this.cells.slice(0).reverse();
    const labelIncrementor = forwards ? 1 : -1;

    // Clone the array and explicitly terminate it by a marked cell
    allCells.concat([CellState.Marked]).forEach((cell, i) => {

      // START SPACE AND LABEL
      if (spaceStart === -1 && cell !== CellState.Marked) { spaceStart = i; labelStart = i; }

      // START BLOCK
      if (blockStart === -1 && cell === CellState.Filled) { blockStart = i; }

      // LABEL
      const label = this.labels[labelIndex];
      // If the label has reached its end
      if (label && labelStart !== -1 && i - labelStart >= label.value) {

        // If the left-bunched label ends with a block...
        if (blockStart !== -1) {
          labelStart = i - label.value;
        } else {
          if (forwards) { label.earliest = labelStart; }
          else { label.latest = this.cells.length - (labelStart + 1); }
          labelStart += (1 + label.value);
          labelIndex += labelIncrementor;
        }
      }

      // END BLOCK
      const spaceIndex = this.spaces.length;
      if (blockStart !== -1 && cell !== CellState.Filled) {
        const blockLen = i - blockStart;
        blocks.push(new BlockSet(blockStart, this.type, ++blockIndex, blockLen, spaceIndex));

        // Closing a block whose length exceeds the label value must reset label start
        if (label && blockLen > label.value) { labelStart = i + 1; }

        // If at the end of block, and we are still on the same label and it fitted ok
        if (label && i - labelStart === label.value) {
          if (forwards) { label.earliest = labelStart; }
          else { label.latest = this.cells.length - (labelStart + 1); }
          labelIndex += labelIncrementor;
          labelStart += (1 + label.value);
        }

        blockStart = -1;
      }

      // END SPACE
      if (spaceStart !== -1 && cell === CellState.Marked) {
        if (forwards) {
          const space = new SpaceSet(spaceStart, this.type, spaceIndex, i - spaceStart);
          this.spaces.push(space);
          this.blocks.push(...blocks);
        }
        // If at the end of space, and we are still on the same label and it fitted ok
        if (label && label.index === labelIndex && i - labelStart >= label.value) {
          if (forwards) { label.earliest = labelStart; }
          else { label.latest = this.cells.length - (labelStart + 1); }
          labelIndex += labelIncrementor;
        }
        blocks = [];
        spaceStart = -1;
        labelStart = this.cells.length;
      }
    });
  }

  private setLabelSpaces(): void {
    this.labels.forEach(l => {
      const spaces = this.spaces.filter(s => l.earliest <= s.end && l.latest >= s.start);
      if (spaces.length === 0) {
        const msg = `At least one label could not be assigned`;
        throw new RangeError(`${msg} - ${this.consoleRef}`);
      }
      this.upsertLinks(l.index, true, spaces, spaces.length === 1);
    });
  }

  private setLabelBlocks(): void {
    this.labels.forEach(l => {
      const labelSpaces = this.getLinksForLabel(l.index, true);
      const labelBlocks = labelSpaces.reduce((acc, curr) => {
        // Blocks not exceeding label value, within range
        const ranged = this.blocks.filter(b => b.start >= l.earliest && b.end <= l.latest && b.size <= l.value);
        return acc.concat(ranged);
      }, [] as BlockSet[]);
      this.upsertLinks(l.index, false, labelBlocks, false);
    });
  }

  /** For each block with only 1 linked label, make the linkage known */
  private updateMaps(): boolean {
    let linksChanged = false;
    this.blocks.forEach(block => {
      const links = this.labelBlockMap.filter(bl => bl.setIndex === block.index);
      if (links.length === 1) {
        const lIdx = links[0].labelIndex;
        const label = this.labels[lIdx];

        // Make a block-label link 'known'
        this.upsertLink(lIdx, block.index, false, true);

        // Which requires: Updating earliest and latest values
        const space = this.spaces.filter(s => s.index === block.spaceIndex)[0];
        label.earliest = Math.max(label.earliest, space.start, 1 + block.end - label.value);
        label.latest = Math.min(label.latest, space.end, block.start + label.value - 1);

        // And: Removing space-links no longer in range
        this.getLinksForLabel(lIdx, true)
          .map(ls => this.spaces[ls.setIndex])
          .filter(s => label.earliest > s.end || label.latest < s.start)
          .forEach(deadLink => this.deleteLink(lIdx, deadLink.index, true));

        // Which itself requires: If one maybe space, making this known
        this.getLinksForLabel(lIdx, true)
          .filter((ls, i, arr) => arr.length === 1)
          .forEach(knownLink => this.upsertLink(lIdx, knownLink.setIndex, true, true));

        // And finally: Removing block-links no longer in range
        this.labelBlockMap
          .filter(lb => lb.setIndex !== block.index && lb.labelIndex === lIdx)
          .map(lb => this.blocks[lb.setIndex])
          .filter(b => b.start > label.latest || b.end < label.earliest)
          .forEach(deadLink => { linksChanged = true; this.deleteLink(lIdx, deadLink.index, false); });
      }
    });
    return linksChanged;
  }

  /** Now the maps are good set min and max values based on labels. */
  private applyBlockValueRanges(): void {
    this.blocks.forEach(block => {
      block.minSize = this.cells.length;
      block.maxSize = 0;
      this.getLinksForSet(block.index, false)
        .map(bl => this.labels[bl.labelIndex])
        .forEach(l => {
          block.minSize = Math.min(block.minSize, l.value);
          block.maxSize = Math.max(block.maxSize, l.value);
        });
    });
  }

  /** Now min and max are good, inspect for unbridgable blocks and return whether links have changed as a result. */
  private applyBlockPositionRanges(): boolean {
    let linksChanged = false;
    this.blocks.forEach((block, bIdx) => {
      const space = this.spaces.filter(s => s.index === block.spaceIndex)[0];
      const sibBlocks = this.blocks.filter(b => b.spaceIndex === block.spaceIndex);

      // Neighbouring unbridgable blocks
      const prevUnBlk = sibBlocks.filter(b => b.index === bIdx - 1 && 1 + block.start - b.maxSize > b.end)[0];
      const nextUnBlk = sibBlocks.filter(b => b.index === bIdx + 1 && block.end + b.maxSize - 1 < b.start)[0];
      const unlEdge = prevUnBlk == null ? space.start : prevUnBlk.end + 2;
      const unrEdge = nextUnBlk == null ? space.end : nextUnBlk.start - 2;

      if (prevUnBlk) { linksChanged = linksChanged || this.tryRemoveLinks(bIdx, false); }
      if (nextUnBlk) { linksChanged = linksChanged || this.tryRemoveLinks(bIdx, true); }

      // Edging away from calculated edges
      block.leftEdge = Math.min(block.start, 1 + unrEdge - block.minSize);
      block.rightEdge = Math.max(block.end, unlEdge + block.minSize - 1);

      // If edged out, update known labels of the block according to new limits
      if (block.leftEdge < block.start || block.rightEdge > block.end) {
        this.labelBlockMap
          .filter(bl => bl.setIndex === block.index && bl.known)
          .forEach(bl => {
            const label = this.labels[bl.labelIndex];
            label.earliest = Math.max(label.earliest, space.start, 1 + block.rightEdge - label.value);
            label.latest = Math.min(label.latest, space.end, block.leftEdge + label.value - 1);
          });
      }
    });
    return linksChanged;
  }

  /** Checks whether block and neighbouring unbridgable block need labels removing. */
  private tryRemoveLinks(blockIndex: number, forNext: boolean): boolean {
    const neighbourIndex = forNext ? blockIndex + 1 : blockIndex - 1;
    const blockLabelLinks = this.getLinksForSet(blockIndex, false);
    const blockLabelIdx = this.getLinksForSet(blockIndex, false).map(li => li.labelIndex).join(',');
    const unbrLabelIdx = this.getLinksForSet(neighbourIndex, false).map(li => li.labelIndex).join(',');
    if (blockLabelLinks.length === 2 && unbrLabelIdx === blockLabelIdx) {
      this.deleteLink(blockLabelLinks[forNext ? 0 : 1].labelIndex, neighbourIndex, false);
      this.deleteLink(blockLabelLinks[forNext ? 1 : 0].labelIndex, blockIndex, false);
      return true;
    }
    return false;
  }

  /** Removes block/label links where label count matches distinct block count */
  private applyDistinctBlockPairing(): boolean {
    let linksChanged: boolean;
    let prevBlock: BlockSet;
    let prevInReach: boolean;
    let labelIndex: number;
    const labelAssignment: any = [];

    // Assemble distinct block count by label index
    this.blocks.forEach((currBlock, blockIndex) => {
      prevBlock = this.blocks[blockIndex - 1];
      prevInReach = prevBlock
        && prevBlock.spaceIndex === currBlock.spaceIndex
        && prevBlock.start + prevBlock.maxSize - 1 >= currBlock.rightEdge;
      labelIndex = prevInReach ? labelAssignment.length - 1 : labelAssignment.length;
      labelAssignment[labelIndex] = labelAssignment[labelIndex] || [];
      labelAssignment[labelIndex].push(blockIndex);
    });

    // If counts match, remove block links except for those assembled
    if (labelAssignment.length === this.labels.length) {
      this.labels.forEach((lbl) => {
        this.getLinksForLabel(lbl.index, false)
          .filter(ln => labelAssignment[lbl.index].indexOf(ln.setIndex) === -1)
          .forEach(dl => {
            linksChanged = true;
            this.deleteLink(dl.labelIndex, dl.setIndex, false);
          });
      });
      return linksChanged;
    }
    return false;
  }
}
