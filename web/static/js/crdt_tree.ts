// WIP tentative implementation

import { AATree, OrderStats } from "augmented-aa-tree";

import * as Char from "./char";
import * as Identifier from "./identifier";

import { Crdt, LocalChange } from "./crdt";

type Position = Identifier.t[];

function comparePosition(p1: Position, p2: Position): "eq" | "gt" | "lt" {
    switch (Char.comparePosition(p1, p2)) {
        case 0: return "eq";
        case 1: return "gt";
        case -1: return "lt";
        default: throw Error("should be 0, 1 or -1");
    }
}

function newline(char: Char.t): number {
    return char.value === "\n" ? 1 : 0;
}

class LineOrderStats implements OrderStats<Position, Char.t> {
    constructor(public lineCount: number) {}

    public of(key: Position, value: Char.t, left: LineOrderStats, right: LineOrderStats): LineOrderStats {
        return new LineOrderStats(
            newline(value) +
            (left ? left.lineCount : 0) +
            (right ? right.lineCount : 0),
        );
    }
}

export class TreeCrdt implements Crdt {
    private crdt: AATree<Position, Char.t>;

    public init(init: Char.Serial[]) {
        this.crdt = new AATree<Position, Char.t>(comparePosition, new LineOrderStats(0));
    }

    public toString(): string {
        return Array.from(this.crdt.iter()).map(([key, char]) => char).join("");
    }

    public remoteInsert(char: Char.t): LocalChange | null {
        if (this.crdt.find(char.position)) {
            // Idempotency: ignore insert operation if character is already there
            return null;
        } else {
            // this.crdt = this.crdt.insert(char.position, char);
            // const charIndex = this.crdt.findIndexOf(char.position)!
            // const lineIndex = this.crdt.findStatOf(char.position, "lineCount") - newline(char);
            // const colIndex = charIndex - (this.crdt.nthStat("lineCount", lineIndex) as number);
            return null;
        }
    }

    public remoteDelete(char: Char.t): LocalChange | null {
        return null;
    }

    public localInsert(lamport: number, site: number, change: LocalChange): Char.t[] {
        return [];
    }

    public localDelete(change: LocalChange): Char.t[] {
        return [];
    }
}
