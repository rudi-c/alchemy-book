import { List } from 'immutable'

import CodeMirror from "codemirror"

export module Crdt {
    export module Char {
        export module Identifier {
            export type t = {
                pos: number
                site: number
            }

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
        export type t = {
            position: Identifier.t[]
            lamport: number
            value: string
        }

        export type Serial = [[number, number][], number, string]

        export function create(position: Identifier.t[], lamport: number, value: string) {
            const obj = { position, lamport, value };
            Object.freeze(obj);
            return obj;
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

        export function equals(c1: Char.t, c2: Char.t): boolean {
            if (c1.position.length !== c2.position.length) return false;
            if (c1.lamport !== c2.lamport) return false;
            if (c1.value !== c2.value) return false;
            for (let i = 0; i < c1.position.length; i++) {
                if (!Identifier.equals(c1.position[i], c2.position[i])) return false;
            }
            return true;
        }
    }
    export module RemoteChange {
        export type t = ["add" | "remove", Char.t]

        export function add(char: Char.t): t {
            return ["add", char];
        }
        export function remove(char: Char.t): t {
            return ["remove", char];
        }
    }
    export module LocalChange {
        export type t = {
            from: CodeMirror.Position
            to: CodeMirror.Position
            text: string
        } | null

        export function create(from: CodeMirror.Position, to: CodeMirror.Position, text: string): t {
            const obj = { from, to, text };
            Object.freeze(obj);
            return obj;
        }
    }
    export type t = List<List<Char.t>>

    export function updateAndConvertLocalToRemote(crdt: t, change: CodeMirror.EditorChange): [t, RemoteChange.t[]] {
        switch (change.origin) {
            case "+delete":
                // TODO: put an assertion here
                return updateCrdtRemove(crdt, change);
            case "+input":
            case "paste":
                const [updatedCrdt, removeChanges] = updateCrdtRemove(crdt, change);
                const [finalCrdt, insertChanges] = updateCrdtInsert(crdt, change);
                return [finalCrdt, removeChanges.concat(insertChanges)];
            default:
                throw "Unknown change origin " + change.origin;
        }
    }

    export function updateAndConvertRemoteToLocal(crdt: t, change: RemoteChange.t): [t, LocalChange.t] {
        const char = change[1];
        switch(change[0]) {
            case "add":
                throw "TODO";
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
                        const change = LocalChange.create({line, ch}, {line, ch: ch+1}, "");
                        return [crdt.set(line, newLine), change];
                    }
                } else {
                    return [crdt, null];
                }
            default: throw "unknown remote change"
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
        return line.findIndex(char => char!.value === '\n');
    }

    function updateCrdtRemove(crdt: t, change: CodeMirror.EditorChange): [t, RemoteChange.t[]] {
        if (change.from.line > change.to.line || (change.from.line === change.to.line && change.from.ch > change.to.ch)) {
            throw "TODO: handle inverted from/to"
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
                throw "size does not match";
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

    function updateCrdtInsert(crdt: t, change: CodeMirror.EditorChange): [t, RemoteChange.t[]] {
        // TODO
        return [crdt, []];
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
                    default: throw "Unknown behavior"
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