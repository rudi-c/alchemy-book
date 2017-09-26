import * as CodeMirror from "codemirror";

import {
    Crdt,
    LocalChange,
    RemoteChange,
    updateAndConvertLocalToRemote,
    updateAndConvertRemoteToLocal
} from "./crdt";
import { LinearCrdt } from "./crdt_linear"
import { EditorSocket, UserPresence } from "./editor_socket";
import History from "./history";
import RemoteCursor from "./remote_cursor";

const IgnoreRemote = "ignore_remote";
const UndoRedo = "undo_redo";

export default class Editor {
    protected codemirror: CodeMirror.Editor;
    protected crdt: Crdt;
    protected editorSocket: EditorSocket;
    protected history: History;
    protected lamport: number;
    protected site: number;

    // Map user_id -> site_id -> cursor element
    // Since the same user could have the same document open on multiple tabs,
    // thus have multiple sites.
    protected cursorWidgets: Map<number, Map<number, RemoteCursor>>;

    constructor(domNode: HTMLTextAreaElement, editorSocket: EditorSocket) {
        this.codemirror = CodeMirror.fromTextArea(domNode, {
            lineNumbers: true,
            theme: "zenburn",
        });
        this.editorSocket = editorSocket;

        this.editorSocket.connect(this.onInit, this.onRemoteChange);
        this.codemirror.on("beforeChange", this.beforeChange);
        this.codemirror.on("change", this.onLocalChange);
        this.codemirror.on("cursorActivity", this.onLocalCursor);

        this.cursorWidgets = new Map();

        this.history = new History();
    }

    // TODO: Inefficient, any one cursor movement causes all others to be redraw
    public updateCursors(presences: UserPresence[]): void {
        const cursorsToDelete = this.allCursors();
        presences.forEach(presence => {
            // Don't draw a remote cursor for your own instance!
            if (presence.siteId !== this.site) {
                const cursor = this.getCursorFor(presence);
                cursor.moveTo(presence.cursor);

                cursorsToDelete.delete(cursor);
            }
        });

        // Remaining cursors are probably from old sessions, remove them
        cursorsToDelete.forEach(cursor => {
            cursor.detach();
            this.cursorWidgets.get(cursor.userId)!.delete(cursor.siteId);
        });
    }

    protected beforeChange = (editor: CodeMirror.Editor, change: CodeMirror.EditorChangeCancellable) => {
        if (change.origin === "undo") {
            change.cancel();

            // Creating local changes to the document from inside the beforeChange
            // event handler is a bad idea, according to the CodeMirror docs. So
            // we do it at a later iteration of the event loop instead.
            setTimeout(() => {
                this.undo();
            }, 0);
        }

        // TODO: Not sure how to get the redo event to trigger, Ctrl-Y and Ctrl-Shift-Z don't work
        if (change.origin === "redo") {
            change.cancel();

            // Similarly
            setTimeout(() => {
                this.redo();
            }, 0);
        }
    }

    protected onLocalCursor = (editor: CodeMirror.Editor) => {
        this.editorSocket.sendCursor(editor.getDoc().getCursor());

        // TODO: Invalidating the history based on cursor movements doesn't work right
        // now because any insertion will cause the cursor to move. Need a way to determine
        // when a movement is really just a movement.
        // this.history.onCursorMove();
    }

    protected onLocalChange = (editor: CodeMirror.Editor, change: CodeMirror.EditorChange) => {
        // TODO: Handle error
        if (![IgnoreRemote, UndoRedo, "setValue"].includes(change.origin)) {
            this.lamport = this.lamport + 1;
            const changes = updateAndConvertLocalToRemote(this.crdt, this.lamport, this.site, change);
            this.history.onChanges(changes);
            changes.forEach(change => this.editorSocket.sendChange(change, this.lamport));
        }
    }

    protected onRemoteChange = ({change, lamport}) => {
        this.lamport = Math.max(this.lamport, lamport) + 1;
        this.convertRemoteToLocal(change);
    }

    protected onInit = (resp) => {
        this.crdt = new LinearCrdt();
        this.crdt.init(resp.state);
        this.site = resp.site;
        this.lamport = 0;
        this.codemirror.setValue(this.crdt.toString());
    }

    private undo(): void {
        this.lamport = this.lamport + 1;
        this.applyUndoRedo(this.history.makeUndoChanges(this.lamport));
    }

    private redo(): void {
        this.lamport = this.lamport + 1;
        this.applyUndoRedo(this.history.makeRedoChanges(this.lamport));
    }

    private applyUndoRedo(changes: RemoteChange.t[] | null): void {
        if (changes) {
            changes.forEach(change => {
                this.convertRemoteToLocal(change);
                this.editorSocket.sendChange(change, this.lamport);
            });
        }
    }

    private convertRemoteToLocal(change: RemoteChange.t): void {
        const localChange = updateAndConvertRemoteToLocal(this.crdt, change);
        if (localChange) {
            this.codemirror.getDoc().replaceRange(localChange.text,
                localChange.from, localChange.to, IgnoreRemote);
        }
    }

    private getCursorFor(presence: UserPresence): RemoteCursor {
        let sites;
        if (this.cursorWidgets.has(presence.userId)) {
            sites = this.cursorWidgets.get(presence.userId);
        } else {
            sites = new Map();
            this.cursorWidgets.set(presence.userId, sites);
        }

        let cursor;
        if (sites.has(presence.siteId)) {
            cursor = sites.get(presence.siteId);
        } else {
            cursor = new RemoteCursor(presence.color,
                presence.userId, presence.siteId, this.codemirror);
            sites.set(presence.siteId, cursor);
        }

        return cursor;
    }

    private allCursors(): Set<RemoteCursor> {
        const cursors: Set<RemoteCursor> = new Set();
        this.cursorWidgets.forEach(sites => {
            sites.forEach(cursor => cursors.add(cursor));
        });
        return cursors;
    }
}
