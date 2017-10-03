import { List } from "immutable";

import * as Char from "./char";

import { Crdt, LocalChange } from "./crdt";

export type t = List<List<Char.t>>;

function findNewline(line: List<Char.t>): number {
    return line.findIndex(char => char!.value === "\n");
}

function updateCrdtRemove(crdt: t, change: LocalChange): [t, Char.t[]] {
    const lines = crdt.slice(change.from.line, change.to.line + 1);

    const linesAndUpdates = lines.map((line, index) => {
        let startIndex;
        let endIndex;
        if (index === 0) {
            // First line
            startIndex = change.from.ch;
        } else {
            startIndex = 0;
        }
        if (index === lines.size - 1) {
            // Last line
            endIndex = change.to.ch;
        } else {
            endIndex = line!.size;
        }
        const toRemove = line!.slice(startIndex, endIndex);
        if (toRemove.size !== endIndex - startIndex) {
            throw new Error("size does not match");
        }
        const updatedLine = line!.splice(startIndex, endIndex - startIndex).toList();
        return [updatedLine, toRemove] as [List<Char.t>, List<Char.t>];
    });
    const updatedLines = linesAndUpdates.map(tuple => tuple![0]);
    const toRemove = linesAndUpdates.flatMap(tuple => tuple![1]);

    // Only the first and last line should be non-empty, so we just keep those.
    let newCrdt;
    if (lines.size === 1) {
        newCrdt = crdt.set(change.from.line, updatedLines.first());
    } else {
        const remainingLine = updatedLines.first().concat(updatedLines.last()).toList();
        newCrdt = crdt.splice(change.from.line, lines.size, remainingLine).toList();
    }

    return [newCrdt, toRemove.toArray()];
}

function updateCrdtInsert(crdt: t, lamport: number, site: number,
                          change: LocalChange): [t, Char.t[]] {
    const { line: lineIndex, ch } = change.from;
    const line = crdt.get(lineIndex);
    const [before, after] = splitLineAt(line, ch);

    // For now, just insert characters one at a time. Eventually, we may
    // want to generate fractional indices in a more clever way when many
    // characters are inserted at the same time.
    let previousChar = getPrecedingChar(crdt, lineIndex, ch);
    const nextChar = getCharAt(crdt, lineIndex, ch);
    let currentLine = before;
    const lines: Array<List<Char.t>> = [];
    const addedChars: Char.t[] = [];
    Array.from(change.text).forEach(addedChar => {
        const newPosition = Char.generatePositionBetween(
            previousChar.position, nextChar.position, site);
        const newChar = Char.create(newPosition, lamport, addedChar);
        currentLine = currentLine.push(newChar);
        if (addedChar === "\n") {
            lines.push(currentLine);
            currentLine = List();
        }

        addedChars.push(newChar);

        previousChar = newChar;
    });

    currentLine = currentLine.concat(after).toList();
    lines.push(currentLine);

    const updatedCrdt = crdt.splice(lineIndex, 1, ...lines).toList();
    return [updatedCrdt, addedChars];
}

function splitLineAt(line: List<Char.t>, at: number): [List<Char.t>, List<Char.t>] {
    const before = line.slice(0, at).toList();
    const after = line.slice(at, line.size).toList();
    return [before, after];
}

function getPrecedingChar(crdt: t, lineIndex: number, ch: number): Char.t {
    if (ch === 0) {
        if (lineIndex === 0) {
            return Char.startOfFile();
        } else {
            return crdt.get(lineIndex - 1).last();
        }
    } else {
        return crdt.get(lineIndex).get(ch - 1);
    }
}

function getCharAt(crdt: t, lineIndex: number, ch: number): Char.t {
    const line = crdt.get(lineIndex);
    if (ch >= line.size) {
        if (lineIndex === crdt.size - 1 && ch === line.size) {
            return Char.endOfFile();
        } else {
            throw Error("indexing out of bounds");
        }
    } else {
        return line.get(ch);
    }
}

function compareCharWithLine(item: Char.t, line: List<Char.t>): number {
    // Only the last line might have size 0 because all other lines end with a
    // newline
    if (line.size === 0) {
        return Char.compare(item, Char.endOfFile());
    } else {
        return Char.compare(item, line.get(0));
    }
}

// If found: return the line number and column number of the character
// If not found: return the line number and column number of the character
// where it should be if inserted
function findPosition(crdt: t, char: Char.t): [number, number, "found" | "not_found"] {
    // Putting something at the start of the first line (lineIndex == -1) should be in line 0
    const lineIndex = Math.max(0,
        binarySearch(crdt, char, compareCharWithLine, "before"));
    const line = crdt.get(lineIndex);
    const charIndex = binarySearch(line, char, Char.compare, "at");
    if (charIndex < line.size) {
        const found = Char.compare(crdt.get(lineIndex).get(charIndex), char) === 0;
        return [lineIndex, charIndex, found ? "found" : "not_found"];
    } else {
        const isAfterNewline = (charIndex === line.size) && (lineIndex !== crdt.size - 1);
        // All lines except the last one need to end in a newline, so put this character
        // on the next line if it would go at the end of the line.
        if (isAfterNewline) {
            return [lineIndex + 1, 0, "not_found"];
        } else {
            return [lineIndex, charIndex, "not_found"];
        }
    }
}

// Return the index of the item if found
// If not found, return the index of the character where it should be if inserted when using "at"
//               return the index of the character that precedes it when using "before"
export function binarySearch<U, V>(list: List<U>,
                                   item: V,
                                   comparator: (a: V, b: U) => number,
                                   notFoundBehavior: "at" | "before"): number {
    function _binarySearch<T>(start: number, end: number): number {
        if (start >= end) {
            switch (notFoundBehavior) {
                case "at":
                    return start;
                case "before":
                    return start - 1;
                default: throw new Error("Unknown behavior");
            }
        } else {
            const mid = Math.floor((start + end) / 2);
            const comp = comparator(item, list.get(mid));
            if (comp < 0) {
                return _binarySearch(start, mid);
            } else if (comp > 0) {
                return _binarySearch(mid + 1, end);
            } else {
                return mid;
            }
        }
    }
    return _binarySearch(0, list.size);
}

export class LinearCrdt implements Crdt {
    private crdt: t;

    public init(init: Char.Serial[]) {
        let line: List<Char.t> = List();
        let lines: t = List();
        init.forEach(serial => {
            const char = Char.ofArray(serial);
            if (char.value === "\n") {
                line = line.push(char);
                lines = lines.push(line);
                line = List();
            } else {
                line = line.push(char);
            }
        });

        this.crdt = lines.push(line);
    }

    public toString(): string {
        return this.crdt.map(line => line!.map(char => char!.value).join("")).join("");
    }

    public remoteInsert(char: Char.t): LocalChange | null {
        const [lineIndex, ch, found] = findPosition(this.crdt, char);
        const line = this.crdt.get(lineIndex);
        if (found === "not_found") {
            const change = LocalChange.create(
                {line: lineIndex, ch}, {line: lineIndex, ch}, char.value);
            if (char.value === "\n") {
                const [before, after] = splitLineAt(line, ch);
                this.crdt = this.crdt
                    .splice(lineIndex, 1, ...[before.push(char), after])
                    .toList();
                return change;
            } else {
                this.crdt = this.crdt
                    .set(lineIndex, line.insert(ch, char));
                return change;
            }
        } else {
            // Probably means we got a duplicate for some reason
            return null;
        }
    }

    public remoteDelete(char: Char.t): LocalChange | null {
        const [lineIndex, ch, found] = findPosition(this.crdt, char);
        const line = this.crdt.get(lineIndex);
        if (found === "found" && Char.equals(line.get(ch), char)) {
            const newLine = line.remove(ch);
            const nextLine = this.crdt.get(lineIndex + 1);

            if (findNewline(newLine) < 0 && nextLine) {
                // Newline character was removed, need to join with the next line
                const change = LocalChange.create(
                    {line: lineIndex, ch}, {line: lineIndex + 1, ch: 0}, "");
                this.crdt = this.crdt
                    .splice(lineIndex, 2, newLine.concat(nextLine))
                    .toList();
                return change;
            } else {
                const change = LocalChange.create(
                    {line: lineIndex, ch}, {line: lineIndex, ch: ch + 1}, "");
                this.crdt = this.crdt.set(lineIndex, newLine);
                return change;
            }
        } else {
            // Probably means we got a duplicate for some reason
            return null;
        }
    }

    public localInsert(lamport: number, site: number, change: LocalChange): Char.t[] {
        const [newCrdt, remoteChanges] = updateCrdtInsert(this.crdt, lamport, site, change);
        this.crdt = newCrdt;
        return remoteChanges;
    }

    public localDelete(change: LocalChange): Char.t[] {
        const [newCrdt, remoteChanges] = updateCrdtRemove(this.crdt, change);
        this.crdt = newCrdt;
        return remoteChanges;
    }
}
