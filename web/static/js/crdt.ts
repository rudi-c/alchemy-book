import CodeMirror from "codemirror";

import { AATree } from "augmented-aa-tree";

import * as Char from "./char";

export type RemoteChange = ["add" | "remove", Char.t];

export namespace RemoteChange {
    export function add(char: Char.t): RemoteChange {
        return ["add", char];
    }
    export function remove(char: Char.t): RemoteChange {
        return ["remove", char];
    }
}

export interface LocalChange {
    from: CodeMirror.Position;
    to: CodeMirror.Position;
    text: string;
}

export namespace LocalChange {
    export function create(from: CodeMirror.Position, to: CodeMirror.Position, text: string): LocalChange {
        const obj = { from, to, text };
        Object.freeze(obj);
        return obj;
    }
}

export interface Crdt {
    init(init: Char.Serial[]);
    toString(): string;
    remoteInsert(char: Char.t): LocalChange | null;
    remoteDelete(char: Char.t): LocalChange | null;

    // Returns inserted characters
    localInsert(lamport: number, site: number, change: LocalChange): Char.t[];

    // Returns deleted characters
    localDelete(change: LocalChange): Char.t[];
}

export function updateAndConvertLocalToRemote(crdt: Crdt,
                                              lamport: number,
                                              site: number,
                                              change: CodeMirror.EditorChange): RemoteChange[] {
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
            let removeChanges: RemoteChange[] = [];
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

export function updateAndConvertRemoteToLocal(crdt: Crdt, change: RemoteChange): LocalChange | null {
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
