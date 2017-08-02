import * as Char from "./char";
import * as Crdt from "./crdt";

// Actions separated by more than one second go in separate batches
const DELAY_BETWEEN_BATCHES_MS = 1000;

export default class History {
    // Points at the index into history that the previous set of changes can
    // be found at
    private indexIntoHistory: number;
    private invalidated: boolean;
    private history: Crdt.RemoteChange.t[][];
    // Lamport values at the time of undos (needed to redo the operations)
    private lamportUndoStack: number[];
    private lastActionTimestamp: number;

    constructor() {
        this.invalidated = false;
        this.history = [];
        this.indexIntoHistory = -1;
        this.lamportUndoStack = [];
        this.lastActionTimestamp = 0;
    }

    public makeUndoChanges(lamport: number): Crdt.RemoteChange.t[] | null {
        if (this.indexIntoHistory < 0) {
            // No history to undo
            return null;
        }

        if (this.indexIntoHistory < this.history.length - 1) {
            console.warn("Multiple undos not currently supported");
        }

        const undoChanges = this.history[this.indexIntoHistory]
            .map(change => this.invert(change, lamport));

        this.indexIntoHistory -= 1;
        this.lamportUndoStack.push(lamport);

        this.invalidated = true;

        return undoChanges;
    }

    public makeRedoChanges(lamport: number): Crdt.RemoteChange.t[] | null {
        if (this.indexIntoHistory >= this.history.length - 1) {
            // No history to redo
            return null;
        }

        this.indexIntoHistory += 1;
        const lamportAtTimeOfUndo = this.lamportUndoStack.pop()!;

        const redoChanges = this.history[this.indexIntoHistory]
            .map(change => this.invert(change, lamportAtTimeOfUndo))
            .map(change => this.invert(change, lamport));

        // Update the history because if we want to undo again, we'll want to
        // undo the "redone" changes which have newer timestamps.
        this.history[this.indexIntoHistory] = redoChanges;

        this.invalidated = true;

        return redoChanges;
    }

    public onChanges(changes: Crdt.RemoteChange.t[]): void {
        const now = Date.now();

        const newBatch = this.shouldCreateNewActionBatch(now, changes);
        if (newBatch) {
            this.indexIntoHistory += 1;
            this.history.splice(this.indexIntoHistory, this.history.length - this.indexIntoHistory, changes);
        } else {
            this.history[this.indexIntoHistory] = this.history[this.indexIntoHistory].concat(changes);
        }

        this.invalidated = false;
        this.lastActionTimestamp = now;
    }

    public onCursorMove(): void {
        // Cursor movements break batches
        this.invalidated = true;
    }

    private invert(change: Crdt.RemoteChange.t, lamport: number): Crdt.RemoteChange.t {
        const char = change[1];
        switch (change[0]) {
            case "add":
                return ["remove", Char.create(char.position, char.lamport, char.value)];
            case "remove":
                // Add new character but with updated lamport value since we're inserting
                // a new character
                return ["add", Char.create(char.position, lamport, char.value)];
        }
    }

    private shouldCreateNewActionBatch(now: number, changes: Crdt.RemoteChange.t[]): boolean {
        if (this.invalidated) {
            return true;
        }

        // Only batch single-character insert/deletes
        if (changes.length > 1) {
            return true;
        }

        const change = changes[0];

        // Don't batch actions that are not nearby in time
        if (now > this.lastActionTimestamp + DELAY_BETWEEN_BATCHES_MS) {
            return true;
        }

        // Nothing to batch if there is no previous history
        if (this.indexIntoHistory < 0) {
            return true;
        }

        const additions = this.history[this.indexIntoHistory]
            .reduce((sum, change) => sum + (change[0] === "add" ? 1 : 0), 0);

        switch (change[0]) {
            case "add":
                // Break large insertions into pieces
                if (additions >= 10) {
                    return true;
                }
                // Break batches by whitespace
                if (" \t\n\r".includes(change[1].value)) {
                    return true;
                }
                break;
            case "remove":
                // Handle removals separately from additions
                if (additions > 0) {
                    return true;
                }
                // Break large deletes into pieces
                if (this.history[this.indexIntoHistory].length >= 10) {
                    return true;
                }
                break;
        }

        return false;
    }
}
