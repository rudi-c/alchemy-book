import { List } from "immutable";

import CodeMirror from "codemirror";

export namespace Crdt {
    export namespace Char {
        export namespace Identifier {
            export interface t {
                pos: number;
                site: number;
            }
            export const BASE = 256;

            export function create(pos: number, site: number): t {
                const obj = { pos, site };
                Object.freeze(obj);
                return obj;
            }

            export function ofArray(array: [number, number]): t {
                return create(array[0], array[1]);
            }

            export function toArray(identifier: t): [number, number] {
                return [identifier.pos, identifier.site];
            }

            export function compare(i1: Identifier.t, i2: Identifier.t) {
                if (i1.pos < i2.pos) {
                    return -1;
                } else if (i1.pos > i2.pos) {
                    return 1;
                } else {
                    if (i1.site < i2.site) {
                        return -1;
                    } else if (i1.site > i2.site) {
                        return 1;
                    } else {
                        return 0;
                    }
                }
            }

            export function equals(i1: Identifier.t, i2: Identifier.t): boolean {
                return i1.pos === i2.pos && i1.site === i2.site;
            }
        }
        export interface t {
            position: Identifier.t[];
            lamport: number;
            value: string;
        }

        export type Serial = [Array<[number, number]>, number, string];

        export function create(position: Identifier.t[], lamport: number, value: string) {
            const obj = { position, lamport, value };
            Object.freeze(obj);
            return obj;
        }

        export function startOfFile(): t {
            return create([Identifier.create(0, 0)], 0, "^");
        }

        export function endOfFile(): t {
            return create([Identifier.create(Identifier.BASE, 0)], 0, "$");
        }

        export function ofArray(array: Serial): t {
            return create(array[0].map(Identifier.ofArray), array[1], array[2]);
        }

        export function toArray(obj: t): Serial {
            const position = obj.position.map(Identifier.toArray);
            return [position, obj.lamport, obj.value];
        }

        export function compare(c1: Char.t, c2: Char.t): number {
            for (let i = 0; i < Math.min(c1.position.length, c2.position.length); i++) {
                const comp = Identifier.compare(c1.position[i], c2.position[i]);
                if (comp != 0) {
                    return comp;
                }
            }
            if (c1.position.length < c2.position.length) {
                return - 1;
            } else if (c1.position.length > c2.position.length) {
                return 1;
            } else {
                return 0;
            }
        }

        // Generate a position 1/16th of the way from c1 to c2. The idea is that insertions are going
        // to lean very heavily towards the right.
        export function generatePositionBetween(c1: Char.t, c2: Char.t, site: number): Identifier.t[] {
            const gap = 16;
            const n1 = c1.position.map(ident => ident.pos);
            const n2 = c2.position.map(ident => ident.pos);
            matchDigits(n1, n2);
            const difference = subtractGreaterThan(n2, n1);

            if (needsNewDigit(difference, gap)) {
                difference.push(0);
            }

            const offset = pseudoIntegerDivision(difference, gap);

            // TODO: add randomness

            const newPosition = addNoCarry(n1, offset);

            // Pair each digit with a site
            return newPosition.map((digit, index) => {
                if (index == newPosition.length - 1) {
                    return Identifier.create(digit, site);
                } else if (digit == c1.position[index].pos) {
                    return Identifier.create(digit, c1.position[index].site);
                } else if (digit == c2.position[index].pos) {
                    return Identifier.create(digit, c2.position[index].site);
                } else {
                    return Identifier.create(digit, site);
                }
            });
        }

        export function equals(c1: Char.t, c2: Char.t): boolean {
            if (c1.position.length !== c2.position.length) return false;
            if (c1.lamport !== c2.lamport) return false;
            if (c1.value !== c2.value) return false;
            for (let i = 0; i < c1.position.length; i++) {
                if (!Identifier.equals(c1.position[i], c2.position[i])) return false;
            }
            return true;
        }

        // Calculate (n1 - n2) where n1 > n2
        function subtractGreaterThan(n1: number[], n2: number[]): number[] {
            let carry = 0;
            const diff: number[] = [];
            for (let i = n1.length - 1; i >= 0; i--) {
                const d1 = n1[i] - carry;
                const d2 = n2[i];
                if (d1 < d2) {
                    carry = 1;
                    diff.push(d1 + Identifier.BASE - d2);
                } else {
                    carry = 0;
                    diff.push(d1 - d2);
                }
            }
            return diff;
        }

        // Calculate (n1 + n2) where we are guaranteed that n2 << n1 such that
        // (n1 + n2) will not have more digits than n1.
        function addNoCarry(n1: number[], n2: number[]): number[] {
            let carry = 0;
            const diff: number[] = [];
            for (let i = n1.length - 1; i >= 0; i--) {
                const sum = n1[i] + n2[i] + carry;
                carry = Math.floor(carry / Identifier.BASE);
                diff.push(sum % Identifier.BASE);
            }
            if (carry !== 0) {
                throw new Error("there should be no carry");
            }
            return diff;
        }

        // Calculate (dividend / divisor) assuming (BASE % divisor == 0) and
        // do integer truncation (don't add more digits)
        function pseudoIntegerDivision(dividend: number[], divisor: number): number[] {
            if (Identifier.BASE % divisor != 0) {
                throw new Error("expected divisor to be a factor of base");
            }
            let carry = 0;
            return dividend.map(digit => {
                const twoDigits = (digit + carry) * Identifier.BASE / divisor;
                carry = twoDigits % Identifier.BASE;
                return Math.floor(twoDigits / Identifier.BASE);
            });
        }

        // Pad n1 and n2 with 0s at the end such that they have the same
        // number of digits.
        function matchDigits(n1: number[], n2: number[]): void {
            for (let i = n1.length; i < n2.length; i++) {
                n1.push(0);
            }
            for (let i = n2.length; i < n1.length; i++) {
                n2.push(0);
            }
        }

        function needsNewDigit(n: number[], requiredGap: number) {
            if (n[n.length - 1] < requiredGap) {
                const leadingZeroes =
                    n.slice(0, n.length - 1)
                     .every(digit => digit == 0);
                return leadingZeroes;
            }
            return false;
        }
    }
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

                // TODO: compare the character before and after the cursor. If
                // the positions match, then fractional indexing, doesn't work,
                // even with sites (won't guarantee order intention). Need to
                // delete the after character and reinsert it with a different
                // index.

                const [finalCrdt, insertChanges] = updateCrdtInsert(updatedCrdt, lamport, site, change);
                return [finalCrdt, removeChanges.concat(insertChanges)];
            default:
                throw new Error("Unknown change origin " + change.origin);
        }
    }

    export function updateAndConvertRemoteToLocal(crdt: t, change: RemoteChange.t): [t, LocalChange.t] {
        const char = change[1];
        switch (change[0]) {
            case "add":
                throw new Error("TODO");
            case "remove":
                const [line, ch, found] = findPosition(crdt, char);
                if (found === "found" && Char.equals(crdt.get(line).get(ch), char)) {
                    const newLine = crdt.get(line).remove(ch);
                    const nextLine = crdt.get(line + 1);

                    let updatedCrdt;
                    if (findNewline(newLine) < 0 && nextLine) {
                        // Newline character was removed, need to join with the next line
                        const change = LocalChange.create({line, ch}, {line: line + 1, ch: 0}, "");
                        return [crdt.splice(line, 2, newLine.concat(nextLine)).toList(), change];
                    } else {
                        const change = LocalChange.create({line, ch}, {line, ch: ch + 1}, "");
                        return [crdt.set(line, newLine), change];
                    }
                } else {
                    return [crdt, null];
                }
            default: throw new Error("unknown remote change");
            //default: const _exhaustiveCheck: never = "never";
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
        if (change.from.line > change.to.line || (change.from.line === change.to.line && change.from.ch > change.to.ch)) {
            throw new Error("TODO: handle inverted from/to");
        }

        const lines = crdt.slice(change.from.line, change.to.line + 1);

        const linesAndUpdates = lines.map((line, index) => {
            let startIndex;
            let endIndex;
            if (index == 0) {
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
        if (lines.size == 1) {
            newCrdt = crdt.set(change.from.line, updatedLines.first());
        } else {
            const remainingLine = updatedLines.first().concat(updatedLines.last());
            newCrdt = crdt.splice(change.from.line, lines.size, remainingLine).toList();
        }

        return [newCrdt, toRemove.toArray()];
    }

    function updateCrdtInsert(crdt: t, lamport: number,
                              site: number,
                              change: CodeMirror.EditorChange): [t, RemoteChange.t[]] {
        if (change.from.line > change.to.line || (change.from.line === change.to.line && change.from.ch > change.to.ch)) {
            throw new Error("TODO: handle inverted from/to");
        }

        const { line: lineIndex, ch } = change.from;
        const line = crdt.get(lineIndex);
        const before = line.slice(0, ch);
        const after = line.slice(ch, line.size);

        // For now, just insert characters one at a time. Eventually, we may
        // want to generate fractional indices in a more clever way when many
        // characters are inserted at the same time.
        let previousChar = before.size > 0 ? before.last() : Char.startOfFile();
        const nextChar = after.size > 0 ? after.first() : Char.endOfFile();
        let currentLine = before.toList();
        const lines: Array<List<Char.t>> = [];
        const remoteChanges: RemoteChange.t[] = [];
        change.text.forEach(addedLine => {
            Array.from(addedLine).forEach(addedChar => {
                const newPosition = Char.generatePositionBetween(previousChar, nextChar, site);
                previousChar = Char.create(newPosition, lamport, addedChar);
                currentLine = currentLine.push(previousChar);
                if (addedChar === "\n") {
                    lines.push(currentLine);
                    currentLine = List();
                }
            });
        });

        currentLine = currentLine.concat(after).toList();
        lines.push(currentLine);

        const updatedCrdt = crdt.splice(lineIndex, change.text.length, lines).toList();
        return [updatedCrdt, remoteChanges];
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
            const found = Char.compare(crdt.get(lineIndex).get(charIndex), char) == 0;
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
}
