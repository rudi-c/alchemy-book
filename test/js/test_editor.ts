import test from "ava"

import * as Combinatorics from "js-combinatorics"

import * as Char from "../../web/static/js/char"
import * as Crdt from "../../web/static/js/crdt"
import Editor from "../../web/static/js/editor"
import { EditorSocket } from "../../web/static/js/editor-socket"

class TestChannel {
    sockets: TestEditorSocket[];

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
class TestEditorSocket extends EditorSocket {
    // Don't expect a lot of messages while testing, so a simple array
    // will do instead of a queue
    messageQueue: any[];
    fakeChannel: TestChannel;

    constructor(documentId: string, channel: TestChannel) {
        super(documentId, () => {});

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
        // TODO: Cursors not tested for now
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

class TestEditor extends Editor {
    public getText(): string {
        if (this.codemirror.getValue() !== Crdt.to_string(this.crdt)) {
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
            state: val,
            site
        });
    }
}

function createEditors(n: number): TestEditor[] {
    const editors: TestEditor[] = [];
    const channel = new TestChannel();
    for (let i = 0; i < n; i++) {
        const textarea = document.createElement("textarea");
        document.body.appendChild(textarea);
        const editor = new TestEditor(
            textarea, new TestEditorSocket("mydoc", channel)
        );
        editor.init([], i);
        editors.push(editor);
    }
    return editors;
}

// To make sure that the system behaves as expected regardless of the order that
// different events happen on the client, we want to test all permutations on the
// order of those events.
//
// The function `runPermutations` permutes the action of `editorCount` editors
// by giving the test function a permutation runner that takes an array of thunks,
// and runs those thunks in some order.
type RunPermutation = (thunks: (() => void)[]) => void
function runPermutations(editorCount: number, test: (_: RunPermutation) => void): void {
    Combinatorics.permutation([...Array(editorCount).keys()])
                 .forEach(permutation => {
        test(thunks => {
            permutation.forEach(i => {
                thunks[i]();
            })
        });
    })
}

test("simple insertion at various places", t => {
    const [e1, e2] = createEditors(2);
    e1.type("b");
    e1.moveCursorLeft(1);
    e1.type("a");
    e1.moveCursorRight(1);
    e1.type("c");
    e1.type("\n");
    e1.type("b");
    e1.moveCursorLeft(1);
    e1.type("a");
    e1.moveCursorRight(1);
    e1.type("c");

    e1.letAllThrough();
    e2.letAllThrough();
    t.is(e1.getText(), "abc\nabc");
    t.is(e2.getText(), "abc\nabc");
});

test("insertions and deletes are idempotent", t => {
    runPermutations(2, runPermutation => {
        const [e1, e2] = createEditors(2);
        e1.type("ac");

        e1.letAllThrough();
        e2.letAllThrough();

        runPermutation([
            () => { 
                e1.backspace();
                e1.type("b");
            },
            () => {
                e2.moveCursorRight(2);
                e2.backspace();
            }
        ])

        e1.duplicateAllMessages();
        e2.duplicateAllMessages();

        e1.letAllThrough();
        e2.letAllThrough();

        t.is(e1.getText(), "ab");
        t.is(e2.getText(), "ab");
    });
});

test("conflicting simple insertions at the same place", t => {
    runPermutations(3, runPermutation => {
        const [e1, e2, e3] = createEditors(3);
        e1.type("ab");

        e1.letAllThrough();
        e2.letAllThrough();
        e3.letAllThrough();

        e1.moveCursor(() => ({ line: 0, ch: 1 }));
        e2.moveCursor(() => ({ line: 0, ch: 1 }));
        e3.moveCursor(() => ({ line: 0, ch: 1 }));

        runPermutation([
            () => e1.type("z"),
            () => e2.type("y"),
            () => e3.type("x")
        ]);

        e1.letAllThrough();
        e2.letAllThrough();
        e3.letAllThrough();

        t.is(e1.getText(), "azyxb");
        t.is(e2.getText(), "azyxb");
        t.is(e3.getText(), "azyxb");
    });
});

test("conflicting insertion between deleted markers", t => {
    runPermutations(3, runPermutation => {
        const [e1, e2, e3] = createEditors(3);
        e1.type("ab");

        e1.letAllThrough();
        e2.letAllThrough();
        e3.letAllThrough();

        e1.moveCursor(() => ({ line: 0, ch: 2 }));
        e2.moveCursor(() => ({ line: 0, ch: 1 }));
        e3.moveCursor(() => ({ line: 0, ch: 1 }));

        runPermutation([
            () => e1.backspace(2),
            () => e2.type("x"),
            () => e3.type("y")
        ]);

        e1.letAllThrough();
        e2.letAllThrough();
        e3.letAllThrough();

        t.is(e1.getText(), "xy");
        t.is(e2.getText(), "xy");
        t.is(e3.getText(), "xy");
    });
});

test("interleaved insertions affecting offsets on the same line", t => {
    runPermutations(3, runPermutation => {
        const [e1, e2, e3] = createEditors(3);

        e1.type("abc");

        e1.letAllThrough();
        e2.letAllThrough();
        e3.letAllThrough();

        e1.moveCursor(() => ({ line: 0, ch: 1 }));
        e2.moveCursor(() => ({ line: 0, ch: 2 }));
        e3.moveCursor(() => ({ line: 0, ch: 3 }));

        runPermutation([
            () => e1.type("1"),
            () => e2.type("2"),
            () => e3.type("3")
        ]);

        e1.letAllThrough();
        e2.letAllThrough();
        e3.letAllThrough();

        t.is(e1.getText(), "a1b2c3");
        t.is(e2.getText(), "a1b2c3");
        t.is(e3.getText(), "a1b2c3");
    });
});

test("interleaved insertions pushing cursors on new lines", t => {
    runPermutations(3, runPermutation => {
        const [e1, e2, e3] = createEditors(3);

        e1.type("abc");

        e1.letAllThrough();
        e2.letAllThrough();
        e3.letAllThrough();

        e1.moveCursor(() => ({ line: 0, ch: 1 }));
        e2.moveCursor(() => ({ line: 0, ch: 2 }));
        e3.moveCursor(() => ({ line: 0, ch: 3 }));

        runPermutation([
            () => e1.type("1\n"),
            () => e2.type("2\n"),
            () => e3.type("3\n")
        ]);

        e1.letAllThrough();
        e2.letAllThrough();
        e3.letAllThrough();

        t.is(e1.getText(), "a1\nb2\nc3\n");
        t.is(e2.getText(), "a1\nb2\nc3\n");
        t.is(e3.getText(), "a1\nb2\nc3\n");
    });
});