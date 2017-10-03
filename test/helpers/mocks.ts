import * as Char from "../../web/static/js/char";

import Editor from "../../web/static/js/editor";
import { EditorSocket } from "../../web/static/js/editor_socket";

export class TestChannel {
    private sockets: TestEditorSocket[];

    constructor() {
        this.sockets = [];
    }

    public register(socket: TestEditorSocket) {
        this.sockets.push(socket);
    }

    public send(sender: TestEditorSocket, message: any) {
        this.sockets.forEach(socket => {
            if (socket !== sender) {
                socket.receive(message);
            }
        });
    }
}

// Replaces the EditorSocket sent to the Editor. Rather than using actual
// WebSockets, each fake socket sends the message immediately to all other
// fake sockets which will buffer the messages in the queue. To test various
// network delay scenarios, those messages have to be manually let through
// via `letOneThrough`.
export class TestEditorSocket extends EditorSocket {
    // Don't expect a lot of messages while testing, so a simple array
    // will do instead of a queue
    private messageQueue: any[];
    private fakeChannel: TestChannel;

    constructor(documentId: string, channel: TestChannel) {
        super(documentId, () => {}, () => {});

        this.messageQueue = [];
        this.fakeChannel = channel;
        this.fakeChannel.register(this);
    }

    public connect(initCallback: (_) => void,
                   changeCallback: (_) => void) {
        this.initCallback = initCallback;
        this.changeCallback = changeCallback;
    }

    public sendChange(change: any, lamport: number) {
        this.fakeChannel.send(this, {change, lamport});
    }

    public sendCursor(cursor: any) {
        // Cursors not tested for now
    }

    public receive(message: any) {
        this.messageQueue.push(message);
    }

    public letOneThrough() {
        if (this.messageQueue.length === 0) {
            throw Error("No messages left in queue!");
        }

        const message = this.messageQueue.shift();
        this.changeCallback(message);
    }

    public letAllThrough() {
        while (this.messageQueue.length > 0) {
            this.letOneThrough();
        }
    }

    public duplicateAllMessages() {
        this.messageQueue = this.messageQueue.concat(this.messageQueue);
    }
}

export class TestEditor extends Editor {
    public getText(): string {
        if (this.codemirror.getValue() !== this.crdt.toString()) {
            throw Error("Editor text and stored text do no match");
        }
        return this.codemirror.getValue();
    }

    public type(insertion: string): void {
        const doc = this.codemirror.getDoc();
        doc.replaceRange(insertion, doc.getCursor(), doc.getCursor(), "+input");
    }

    public delete(count: number = 1): void {
        for (let i = 0; i < count; i++) {
            (this.codemirror as any).execCommand("delCharAfter");
        }
    }

    public backspace(count: number = 1): void {
        for (let i = 0; i < count; i++) {
            (this.codemirror as any).execCommand("delCharBefore");
        }
    }

    public doUndo(): void {
        this.undo();
    }

    public doRedo(): void {
        this.redo();
    }

    public moveCursor(update: (pos: CodeMirror.Position) => CodeMirror.Position): void {
        const doc = this.codemirror.getDoc();
        doc.setCursor(update(doc.getCursor()));
    }

    public moveCursorLeft(amount: number = 1): void {
        this.moveCursor(({ line, ch }) => ({ line, ch: ch - amount }));
    }

    public moveCursorRight(amount: number = 1): void {
        this.moveCursor(({ line, ch }) => ({ line, ch: ch + amount }));
    }

    public letOneThrough(): void {
        (this.editorSocket as TestEditorSocket).letOneThrough();
    }

    public letAllThrough(): void {
        (this.editorSocket as TestEditorSocket).letAllThrough();
    }

    public duplicateAllMessages(): void {
        (this.editorSocket as TestEditorSocket).duplicateAllMessages();
    }

    public init(val: Char.Serial[], site: number): void {
        this.onInit({
            site,
            state: val,
        });
    }
}

export function createEditors(n: number): TestEditor[] {
    const editors: TestEditor[] = [];
    const channel = new TestChannel();
    for (let i = 0; i < n; i++) {
        const textarea = document.createElement("textarea");
        document.body.appendChild(textarea);
        const editor = new TestEditor(
            textarea, new TestEditorSocket("mydoc", channel), () => {},
        );
        editor.init([], i);
        editors.push(editor);
    }
    return editors;
}
