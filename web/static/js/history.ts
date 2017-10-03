import * as Char from "./char";
import * as Crdt from "./crdt";

// Actions separated by more than one second go in separate batches
const DELAY_BETWEEN_BATCHES_MS = 1000;

export default class History {
    // Undo stack
    private history: Crdt.RemoteChange[][];
    // Redo stack
    private future: Crdt.RemoteChange[][];

    private shouldStoreInNewBatch: boolean;

    // Lamport values at the time of undos (needed to redo the operations)
    private lastActionTimestamp: number;

    constructor() {
        this.shouldStoreInNewBatch = false;
        this.history = [];
        this.future = [];
        this.lastActionTimestamp = 0;
    }

    public makeUndoChanges(lamport: number): Crdt.RemoteChange[] | null {
        if (this.history.length === 0) {
            // No history to undo
            return null;
        }

        const undoChanges = this.history.pop()!
            .map(change => this.invert(change, lamport));

        this.future.push(undoChanges);

        this.shouldStoreInNewBatch = true;

        return undoChanges;
    }

    public makeRedoChanges(lamport: number): Crdt.RemoteChange[] | null {
        if (this.future.length === 0) {
            // No history to redo
            return null;
        }

        const redoChanges = this.future.pop()!
            .map(change => this.invert(change, lamport));

        this.history.push(redoChanges);

        this.shouldStoreInNewBatch = true;

        return redoChanges;
    }

    public onChanges(changes: Crdt.RemoteChange[]): void {
        const now = Date.now();

        const newBatch = this.shouldCreateNewActionBatch(now, changes);
        if (newBatch) {
            this.history.push(changes);
        } else {
            changes.forEach(change => {
                this.history[this.history.length - 1].push(change);
            });
        }

        this.shouldStoreInNewBatch = false;
        this.lastActionTimestamp = now;
    }

    public onCursorMove(): void {
        // Cursor movements break batches
        this.shouldStoreInNewBatch = true;
    }

    private invert(change: Crdt.RemoteChange, lamport: number): Crdt.RemoteChange {
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

    private shouldCreateNewActionBatch(now: number, changes: Crdt.RemoteChange[]): boolean {
        if (this.shouldStoreInNewBatch) {
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
        if (this.history.length === 0) {
            return true;
        }

        const lastChanges = this.history[this.history.length - 1];
        const additions = lastChanges.reduce((sum, change) => sum + (change[0] === "add" ? 1 : 0), 0);

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
                if (lastChanges.length >= 10) {
                    return true;
                }
                break;
        }

        return false;
    }
}
