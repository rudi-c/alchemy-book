import { List } from "immutable";

import CodeMirror from "codemirror";

import * as Char from "./char";

export namespace RemoteChange {
    export type t = ["add" | "remove", Char.t];

    export function add(char: Char.t): t {
        return ["add", char];
    }
    export function remove(char: Char.t): t {
        return ["remove", char];
    }
}
export namespace LocalChange {
    export type t = {
        from: CodeMirror.Position
        to: CodeMirror.Position
        text: string,
    } | null;

    export function create(from: CodeMirror.Position, to: CodeMirror.Position, text: string): t {
        const obj = { from, to, text };
        Object.freeze(obj);
        return obj;
    }
}
export type t = List<List<Char.t>>;

export function updateAndConvertLocalToRemote(crdt: t, lamport: number,
                                              site: number,
                                              change: CodeMirror.EditorChange): [t, RemoteChange.t[]] {
    switch (change.origin) {
        case "+delete":
            // TODO: put an assertion here
            return updateCrdtRemove(crdt, change);
        case "+input":
        case "paste":
            const [updatedCrdt, removeChanges] = updateCrdtRemove(crdt, change);
            const [finalCrdt, insertChanges] = updateCrdtInsert(updatedCrdt, lamport, site, change);
            return [finalCrdt, removeChanges.concat(insertChanges)];
        default:
            throw new Error("Unknown change origin " + change.origin);
    }
}

export function updateAndConvertRemoteToLocal(crdt: t, change: RemoteChange.t): [t, LocalChange.t] {
    const char = change[1];
    const [lineIndex, ch, found] = findPosition(crdt, char);
    const line = crdt.get(lineIndex);
    switch (change[0]) {
        case "add":
            if (found === "not_found") {
                const change = LocalChange.create(
                    {line: lineIndex, ch}, {line: lineIndex, ch}, char.value);
                if (char.value === "\n") {
                    const [before, after] = splitLineAt(line, ch);
                    const newCrdt = crdt
                        .splice(lineIndex, 1, ...[before.push(char), after])
                        .toList();
                    return [newCrdt, change];
                } else {
                    const newCrdt = crdt
                        .set(lineIndex, line.insert(ch, char));
                    return [newCrdt, change];
                }
            } else {
                // Probably means we got a duplicate for some reason
                return [crdt, null];
            }
        case "remove":
            if (found === "found" && Char.equals(line.get(ch), char)) {
                const newLine = line.remove(ch);
                const nextLine = crdt.get(lineIndex + 1);

                if (findNewline(newLine) < 0 && nextLine) {
                    // Newline character was removed, need to join with the next line
                    const change = LocalChange.create(
                        {line: lineIndex, ch}, {line: lineIndex + 1, ch: 0}, "");
                    const newCrdt = crdt
                        .splice(lineIndex, 2, newLine.concat(nextLine))
                        .toList();
                    return [newCrdt, change];
                } else {
                    const change = LocalChange.create(
                        {line: lineIndex, ch}, {line: lineIndex, ch: ch + 1}, "");
                    return [crdt.set(lineIndex, newLine), change];
                }
            } else {
                // Probably means we got a duplicate for some reason
                return [crdt, null];
            }
        default: throw new Error("unknown remote change");
        // default: const _exhaustiveCheck: never = "never";
    }
}

export function init(init: Char.Serial[]): t {
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
    return lines.push(line);
}

export function to_string(crdt: t): string {
    return crdt.map(line => line!.map(char => char!.value).join("")).join("");
}

function findNewline(line: List<Char.t>): number {
    return line.findIndex(char => char!.value === "\n");
}

function updateCrdtRemove(crdt: t, change: CodeMirror.EditorChange): [t, RemoteChange.t[]] {
    if (change.from.line > change.to.line ||
        (change.from.line === change.to.line && change.from.ch > change.to.ch)) {
        throw new Error("TODO: handle inverted from/to");
    }

    // Insertions has change.removed = [""]
    if (change.removed.length === 0 && change.removed[0] === "") {
        return [crdt, []];
    }

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
        const toRemove = line!.slice(startIndex, endIndex).map(RemoteChange.remove);
        if (toRemove.size !== endIndex - startIndex) {
            throw new Error("size does not match");
        }
        const updatedLine = line!.splice(startIndex, endIndex - startIndex).toList();
        return [updatedLine, toRemove] as [List<Char.t>, List<RemoteChange.t>];
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

function updateCrdtInsert(crdt: t, lamport: number,
                          site: number,
                          change: CodeMirror.EditorChange): [t, RemoteChange.t[]] {
    if (change.from.line > change.to.line ||
        (change.from.line === change.to.line && change.from.ch > change.to.ch)) {
        throw new Error("TODO: handle inverted from/to");
    }

    // Insertions has change.text = [""]
    if (change.text.length === 0 && change.text[0] === "") {
        return [crdt, []];
    }

    const { line: lineIndex, ch } = change.from;
    const line = crdt.get(lineIndex);
    const [before, after] = splitLineAt(line, ch);

    // For now, just insert characters one at a time. Eventually, we may
    // want to generate fractional indices in a more clever way when many
    // characters are inserted at the same time.
    let previousChar = before.size > 0 ? before.last() : Char.startOfFile();
    const nextChar = after.size > 0 ? after.first() : Char.endOfFile();
    let currentLine = before;
    const lines: Array<List<Char.t>> = [];
    const remoteChanges: RemoteChange.t[] = [];
    change.text.forEach((addedLine, index) => {
        // All strings expect the last one represent the insertion of a new line
        const characters = Array.from(addedLine);
        if (index < change.text.length - 1) {
            characters.push("\n");
        }

        characters.forEach(addedChar => {
            const newPosition = Char.generatePositionBetween(
                previousChar.position, nextChar.position, site);
            const newChar = Char.create(newPosition, lamport, addedChar);
            currentLine = currentLine.push(newChar);
            if (addedChar === "\n") {
                lines.push(currentLine);
                currentLine = List();
            }

            remoteChanges.push(RemoteChange.add(newChar));

            previousChar = newChar;
        });
    });

    currentLine = currentLine.concat(after).toList();
    lines.push(currentLine);

    const updatedCrdt = crdt.splice(lineIndex, 1, ...lines).toList();
    return [updatedCrdt, remoteChanges];
}

function splitLineAt(line: List<Char.t>, at: number): [List<Char.t>, List<Char.t>] {
    const before = line.slice(0, at).toList();
    const after = line.slice(at, line.size).toList();
    return [before, after];
}

// If found: return the line number and column number of the character
// If not found: return the line number and column number of the character
// where it should be if inserted
function findPosition(crdt: t, char: Char.t): [number, number, "found" | "not_found"] {
    // Putting something at the start of the first line (lineIndex == -1) should be in line 0
    const lineIndex = Math.max(0,
        binarySearch(crdt, char, (item, line) => Char.compare(item, line.get(0)), "before"));
    const line = crdt.get(lineIndex);
    const charIndex = binarySearch(line, char, Char.compare, "at");
    if (charIndex < line.size) {
        const found = Char.compare(crdt.get(lineIndex).get(charIndex), char) === 0;
        return [lineIndex, charIndex, found ? "found" : "not_found"];
    } else {
        return [lineIndex, line.size - 1, "not_found"];
    }
}

// Return the index of the item if found
// If not found, return the index of the character where it should be if inserted when using "at"
//               return the index of the character that precedes it when using "before"
function binarySearch<U, V>(list: List<U>,
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
