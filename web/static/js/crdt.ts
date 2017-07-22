import * as Immutable from 'immutable'

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
    export type t = Immutable.List<Immutable.List<Char.t>>

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
                    if (newLine.isEmpty()) {
                        // TODO: deal with empty lines
                        throw "TODO";
                    } else {
                        return [crdt.set(line, newLine), LocalChange.create({line, ch}, {line, ch: ch+1}, "")];
                    }
                } else {
                    return [crdt, null];
                }
            default: throw "unknown remote change"
            //default: const _exhaustiveCheck: never = "never";
        }
    }

    export function init(init: Char.Serial[]): t {
        let line: Immutable.List<Char.t> = Immutable.List();
        let lines: t = Immutable.List();
        init.forEach(serial => {
            const char = Char.ofArray(serial);
            if (char.value === "\n") {
                line = line.push(char);
                lines = lines.push(line);
                line = Immutable.List();
            } else {
                line = line.push(char);
            }
        });
        return lines.push(line);
    }

    export function to_string(crdt: t): string {
        return crdt.map(line => line!.map(char => char!.value).join("")).join("");
    }

    function updateCrdtRemove(crdt: t, change: CodeMirror.EditorChange): [t, RemoteChange.t[]] {
        // TODO: multiple lines
        // TODO: what is "to" and "from" are inverted?
        const line = crdt.get(change.from.line);
        const toRemove = line.slice(change.from.ch, change.to.ch).map(RemoteChange.remove);
        if (toRemove.size !== Math.abs(change.from.ch - change.to.ch)) {
            throw "size does not match"
        }
        // TODO: what's up with the indexed type?
        const updatedLine = line.splice(change.from.ch, change.to.ch - change.from.ch) as any;
        return [crdt.set(change.from.line, updatedLine), toRemove.toArray()];
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
    function binarySearch<U, V>(list: Immutable.List<U>, 
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