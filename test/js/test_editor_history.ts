import test from "ava"

import * as Char from "../../web/static/js/char"
import History from "../../web/static/js/history"

test("cannot undo or redo nothing", t => {
    const history = new History();
    t.is(history.makeUndoChanges(0), null);
    t.is(history.makeRedoChanges(0), null);
});

test("sequential inserts get batched", t => {
    const history = new History();
    history.onChanges([
        ["add", Char.ofArray([[[111, 1]], 0, "a"])],
    ]);
    history.onChanges([
        ["add", Char.ofArray([[[112, 1]], 1, "b"])],
    ]);
    t.is(history.makeUndoChanges(2)!.length, 2);
});

test("insertions of more than one character get their own batch", t => {
    const history = new History();
    history.onChanges([
        ["add", Char.ofArray([[[111, 1]], 0, "a"])],
    ]);
    history.onChanges([
        ["add", Char.ofArray([[[112, 1]], 1, "b"])],
        ["add", Char.ofArray([[[113, 1]], 2, "c"])],
    ]);
    t.is(history.makeUndoChanges(3)!.length, 2);
});

test("insertion on no history is not batched", t => {
    const history = new History();
    history.onChanges([
        ["add", Char.ofArray([[[111, 1]], 0, "a"])],
    ]);
    history.makeUndoChanges(1);
    history.onChanges([
        ["add", Char.ofArray([[[112, 1]], 2, "b"])],
    ]);
    history.onChanges([
        ["add", Char.ofArray([[[113, 1]], 3, "c"])],
    ]);
    t.is(history.makeUndoChanges(4)!.length, 2);
});

test("break apart large insertions", t => {
    const history = new History();
    for (let i = 0; i < 11; i++) {
        history.onChanges([
            ["add", Char.ofArray([[[111 + i, 1]], i, "a"])],
        ]);
    }
    t.is(history.makeUndoChanges(11)!.length, 1);
    t.is(history.makeUndoChanges(12)!.length, 10);
});

test("break apart large deletions", t => {
    const history = new History();
    for (let i = 0; i < 15; i++) {
        history.onChanges([
            ["add", Char.ofArray([[[111 + i, 1]], i, "a"])],
        ]);
    }
    for (let i = 0; i < 15; i++) {
        history.onChanges([
            ["remove", Char.ofArray([[[111 + i, 1]], i, "a"])],
        ]);
    }
    t.is(history.makeUndoChanges(11)!.length, 5);
    t.is(history.makeUndoChanges(12)!.length, 10);
});

test("break apart whitespace insertions", t => {
    const history = new History();
    history.onChanges([
        ["add", Char.ofArray([[[111, 1]], 0, "a"])],
    ]);
    history.onChanges([
        ["add", Char.ofArray([[[112, 1]], 1, " "])],
    ]);
    t.is(history.makeUndoChanges(2)!.length, 1);
    t.is(history.makeUndoChanges(3)!.length, 1);
});

test("sequential deletes get batched without inserts", t => {
    const history = new History();
    history.onChanges([
        ["add", Char.ofArray([[[111, 1]], 0, "a"])],
        ["add", Char.ofArray([[[112, 1]], 1, "b"])],
    ]);
    history.onChanges([
        ["remove", Char.ofArray([[[111, 1]], 0, "a"])],
    ]);
    history.onChanges([
        ["remove", Char.ofArray([[[112, 1]], 1, "b"])],
    ]);
    t.is(history.makeUndoChanges(2)!.length, 2);
});

test("mixed changes is one batch", t => {
    const history = new History();
    history.onChanges([
        ["remove", Char.ofArray([[[111, 1]], 0, "x"])],
        ["remove", Char.ofArray([[[113, 1]], 0, "y"])],
        ["add", Char.ofArray([[[112, 1]], 0, "a"])],
        ["add", Char.ofArray([[[114, 1]], 1, "b"])],
    ]);
    t.is(history.makeUndoChanges(2)!.length, 4);
});

test("cursor movement between two inserts creates two batches", t => {
    const history = new History();
    history.onChanges([
        ["add", Char.ofArray([[[111, 1]], 0, "a"])],
    ]);
    history.onChanges([
        ["add", Char.ofArray([[[112, 1]], 1, "b"])]
    ]);
    history.onCursorMove();
    history.onChanges([
        ["add", Char.ofArray([[[112, 1]], 2, "c"])]
    ]);
    t.is(history.makeUndoChanges(3)!.length, 1);
});

test("time delay between two inserts creates two batches", async t => {
    const history = new History();
    history.onChanges([
        ["add", Char.ofArray([[[111, 1]], 0, "a"])],
    ]);
    history.onChanges([
        ["add", Char.ofArray([[[112, 1]], 1, "b"])]
    ]);

    await (new Promise(resolve => setTimeout(resolve, 1100)));

    history.onChanges([
        ["add", Char.ofArray([[[112, 1]], 2, "c"])]
    ]);
    t.is(history.makeUndoChanges(3)!.length, 1);
});

test("multiple undo redos yield correct operations", t => {
    const history = new History();
    history.onChanges([
        ["add", Char.ofArray([[[111, 1]], 0, "a"])],
    ]);
    history.onChanges([
        ["remove", Char.ofArray([[[111, 1]], 1, "a"])],
        ["add", Char.ofArray([[[112, 1]], 1, "b"])],
    ]);

    t.deepEqual(history.makeUndoChanges(2), [
        ["add", Char.ofArray([[[111, 1]], 2, "a"])],
        ["remove", Char.ofArray([[[112, 1]], 1, "b"])],
    ]);

    t.deepEqual(history.makeRedoChanges(3), [
        ["remove", Char.ofArray([[[111, 1]], 2, "a"])],
        ["add", Char.ofArray([[[112, 1]], 3, "b"])],
    ]);

    t.deepEqual(history.makeUndoChanges(4), [
        ["add", Char.ofArray([[[111, 1]], 4, "a"])],
        ["remove", Char.ofArray([[[112, 1]], 3, "b"])],
    ]);
});