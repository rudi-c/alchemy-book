import CodeMirror from "codemirror";

import { AATree } from "augmented-aa-tree";

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
    };

    export function create(from: CodeMirror.Position, to: CodeMirror.Position, text: string): t {
        const obj = { from, to, text };
        Object.freeze(obj);
        return obj;
    }
}

export interface Crdt {
    init(init: Char.Serial[])
    toString(): string
    remoteInsert(char: Char.t): LocalChange.t | null
    remoteDelete(char: Char.t): LocalChange.t | null

    // Returns inserted characters
    localInsert(lamport: number, site: number, change: LocalChange.t): Char.t[]

    // Returns deleted characters
    localDelete(change: LocalChange.t): Char.t[]
}

export function updateAndConvertLocalToRemote(crdt: Crdt,
                                              lamport: number,
                                              site: number,
                                              change: CodeMirror.EditorChange): RemoteChange.t[] {
    if (change.from.line > change.to.line ||
        (change.from.line === change.to.line && change.from.ch > change.to.ch)) {
        throw new Error("got inverted inverted from/to");
    }

    switch (change.origin) {
        case "+delete":
            const deleteChange = LocalChange.create(change.from, change.to, "");
            return crdt.localDelete(deleteChange).map(RemoteChange.remove);
        case "+input":
        case "paste":
            // Pure insertions have change.removed = [""]
            let removeChanges: RemoteChange.t[] = [];
            if (!(change.removed.length === 1 && change.removed[0] === "")) {
                const deletion = LocalChange.create(change.from, change.to, "");
                removeChanges = crdt.localDelete(deletion).map(RemoteChange.remove);
            }
            // All strings expect the last one represent the insertion of a new line
            const insert = LocalChange.create(change.from, change.to, change.text.join("\n"));
            const insertChanges = crdt.localInsert(lamport, site, insert).map(RemoteChange.add);
            return removeChanges.concat(insertChanges);
        default:
            throw new Error("Unknown change origin " + change.origin);
    }
}

export function updateAndConvertRemoteToLocal(crdt: Crdt, change: RemoteChange.t): LocalChange.t | null {
    const char = change[1];
    switch (change[0]) {
        case "add":
            return crdt.remoteInsert(char);
        case "remove":
            return crdt.remoteDelete(char);
        default: throw new Error("unknown remote change");
        // default: const _exhaustiveCheck: never = "never";
    }
}