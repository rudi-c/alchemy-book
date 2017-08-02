import * as CodeMirror from "codemirror";

import * as Crdt from "./crdt";
import { EditorSocket, UserPresence } from "./editor-socket";

const IgnoreRemote = "ignore_remote";

class RemoteCursor {
    private widget: HTMLElement;

    constructor(color: string,
                public userId: number,
                public siteId: number,
                private codemirror: CodeMirror.Editor) {
        this.codemirror = codemirror;

        const lineHeight = this.codemirror.defaultTextHeight();

        this.widget = document.createElement("div");
        this.widget.style.position = "absolute";
        this.widget.style.width = "3px";
        this.widget.style.height = `${lineHeight}px`;
        this.widget.style.backgroundColor = color;
        this.widget.style.top = "0px";
    }

    public moveTo(pos: CodeMirror.Position): void {
        // Reinsert the cursor every time to move it.
        this.detach();

        if (pos) {
            const coords = this.codemirror.cursorCoords(pos, "local");
            this.widget.style.left = `${coords.left}px`;
            this.codemirror.getDoc().setBookmark(pos, { widget: this.widget });
        }
    }

    public detach(): void {
        if (this.widget.parentElement) {
            this.widget.parentElement.removeChild(this.widget);
        }
    }
}

export default class Editor {
    protected editorSocket: EditorSocket;
    protected crdt: Crdt.t;
    protected lamport: number;
    protected site: number;
    protected codemirror: CodeMirror.Editor;

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
        this.codemirror.on("change", this.onLocalChange);
        this.codemirror.on("cursorActivity", this.onLocalCursor);

        this.cursorWidgets = new Map();
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

    protected onLocalCursor = (editor: CodeMirror.Editor) => {
        this.editorSocket.sendCursor(editor.getDoc().getCursor());
    }

    protected onLocalChange = (editor: CodeMirror.Editor, change: CodeMirror.EditorChange) => {
        // TODO: Handle error
        if (change.origin !== IgnoreRemote && change.origin !== "setValue") {
            this.lamport = this.lamport + 1;
            const [newCrdt, changes] = Crdt.updateAndConvertLocalToRemote(this.crdt, this.lamport, this.site, change);
            this.crdt = newCrdt;
            changes.forEach(change => this.editorSocket.sendChange(change, this.lamport));
        }
    }

    protected onRemoteChange = ({userId, change, lamport}) => {
        this.lamport = Math.max(this.lamport, lamport) + 1;
        const [newCrdt, localChange] = Crdt.updateAndConvertRemoteToLocal(this.crdt, change);
        this.crdt = newCrdt;
        if (localChange) {
            this.codemirror.getDoc().replaceRange(localChange.text, localChange.from, localChange.to, IgnoreRemote);
        }
    }

    protected onInit = (resp) => {
        this.crdt = Crdt.init(resp.state);
        this.site = resp.site;
        this.lamport = 0;
        this.codemirror.setValue(Crdt.to_string(this.crdt));
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
