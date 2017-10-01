import test from "ava"

import * as Combinatorics from "js-combinatorics"

import * as Char from "../../web/static/js/char"
import * as Crdt from "../../web/static/js/crdt"
import Editor from "../../web/static/js/editor"
import { EditorSocket } from "../../web/static/js/editor_socket"

import { createEditors, TestChannel, TestEditor, TestEditorSocket } from "../helpers/mocks"

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

test("insertion at a place of former conflict", t => {
    [0, 1, 2].forEach(inserter => {
        const editors = createEditors(3);
        const [e1, e2, e3] = editors;

        e1.type("||");
        
        e1.letAllThrough();
        e2.letAllThrough();
        e3.letAllThrough();

        e1.moveCursor(() => ({ line: 0, ch: 1 }));
        e2.moveCursor(() => ({ line: 0, ch: 1 }));

        // Conflict! Two insertions at the same place.
        e1.type("a");
        e2.type("b");
        
        e1.letAllThrough();
        e2.letAllThrough();
        e3.letAllThrough();

        const e = editors[inserter];

        // Type a character between the two conflicting characters.
        e.moveCursor(() => ({ line: 0, ch: 2 }));
        e.type("x");
        
        e1.letAllThrough();
        e2.letAllThrough();
        e3.letAllThrough();

        t.is(e1.getText(), "|axb|");
        t.is(e2.getText(), "|axb|");
        t.is(e3.getText(), "|axb|");
    });
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

test("one person typing lots of text", t => {
    const text = "abcdefghijklmnopqrstuvwxyz\n".repeat(1000);
    const [e1, e2] = createEditors(2);

    e1.type(text);

    e1.letAllThrough();
    e2.letAllThrough();

    t.is(e1.getText(), text);
    t.is(e2.getText(), text);
});

test("three people typing lots of text on the same spot", t => {
    const text = "abcdefghijklmnopqrstuvwxyz\n".repeat(100);
    const [e1, e2, e3] = createEditors(3);

    for (let i = 0; i < text.length; i++) {
        e1.type(text[i]);
        e2.type(text[i]);
        e3.type(text[i]);
    }

    e1.letAllThrough();
    e2.letAllThrough();
    e3.letAllThrough();

    const reference = e1.getText();
    t.is(e2.getText(), reference);
    t.is(e3.getText(), reference);
});

test("cannot undo another person's changes", t => {
    const [e1, e2] = createEditors(2);

    e1.type("test");

    e1.letAllThrough();
    e2.letAllThrough();

    e2.doUndo();

    e1.letAllThrough();
    e2.letAllThrough();

    t.is(e1.getText(), "test");
    t.is(e2.getText(), "test");
});

test("undo works with insertion and deletion", t => {
    runPermutations(3, runPermutation => {
        const [e1, e2, e3] = createEditors(3);

        e1.type("abc");

        e1.letAllThrough();
        e2.letAllThrough();
        e3.letAllThrough();

        e2.moveCursor(() => ({ line: 0, ch: 1 }));
        e3.moveCursor(() => ({ line: 0, ch: 3 }));

        runPermutation([
            () => e1.doUndo(),
            () => e2.type("d"),
            () => e3.backspace(),
        ]);

        e1.letAllThrough();
        e2.letAllThrough();
        e3.letAllThrough();

        t.is(e1.getText(), "d");
        t.is(e2.getText(), "d");
        t.is(e3.getText(), "d");
    });
});

test("undo + redo cancels out and works with insertion and deletion", t => {
    for (let i = 1; i < 4; i++) {
        runPermutations(3, runPermutation => {
            const [e1, e2, e3] = createEditors(3);

            e1.type("abc");

            e1.letAllThrough();
            e2.letAllThrough();
            e3.letAllThrough();

            e2.moveCursor(() => ({ line: 0, ch: 1 }));
            e3.moveCursor(() => ({ line: 0, ch: 3 }));

            runPermutation([
                () => {
                    for (let j = 0; j < i; j++) {
                        e1.doUndo();
                        e1.doRedo();
                    }
                },
                () => e2.type("d"),
                () => e3.backspace(),
            ]);

            e1.letAllThrough();
            e2.letAllThrough();
            e3.letAllThrough();

            t.is(e1.getText(), "adbc");
            t.is(e2.getText(), "adbc");
            t.is(e3.getText(), "adbc");
        });
    }
});