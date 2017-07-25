import test from "ava"

import * as Decimal from "../../web/static/js/decimal"
import * as Char from "../../web/static/js/char"

function positions(array: Array<[number, number]>): Char.Identifier.t[] {
    return array.map(Char.Identifier.ofArray);
}

test('serialization/deserialization', t => {
    const c: Char.Serial = [
        [[10, 1], [11, 1], [0, 2]],
        24,
        "c"
    ];
    t.deepEqual(c, Char.toArray(Char.ofArray(c)));
});

test('compare and equals: equals', t => {
    const c1 = Char.ofArray([
        [[10, 1], [11, 1], [0, 2]],
        24,
        "c"
    ]);
    const c2 = Char.ofArray([
        [[10, 1], [11, 1], [0, 2]],
        24,
        "c"
    ]);
    t.true(Char.equals(c1, c2));
    t.true(Char.equals(c2, c1));
    t.is(Char.compare(c1, c2), 0);
    t.is(Char.compare(c2, c1), 0);
});

test('compare and equals: site not equal', t => {
    const c1 = Char.ofArray([
        [[10, 1], [11, 2], [0, 2]],
        24,
        "c"
    ]);
    const c2 = Char.ofArray([
        [[10, 1], [11, 1], [0, 2]],
        24,
        "c"
    ]);
    t.false(Char.equals(c1, c2));
    t.false(Char.equals(c2, c1));
    t.is(Char.compare(c1, c2), 1);
    t.is(Char.compare(c2, c1), -1);
});

test('compare and equals: digit not equal', t => {
    const c1 = Char.ofArray([
        [[10, 1], [12, 1], [0, 2]],
        24,
        "c"
    ]);
    const c2 = Char.ofArray([
        [[10, 1], [11, 1], [0, 2]],
        24,
        "c"
    ]);
    t.false(Char.equals(c1, c2));
    t.false(Char.equals(c2, c1));
    t.is(Char.compare(c1, c2), 1);
    t.is(Char.compare(c2, c1), -1);
});

test('compare and equals: lamport not equal', t => {
    const c1 = Char.ofArray([
        [[10, 1], [11, 1], [0, 2]],
        25,
        "c"
    ]);
    const c2 = Char.ofArray([
        [[10, 1], [11, 1], [0, 2]],
        24,
        "c"
    ]);
    t.false(Char.equals(c1, c2));
    t.false(Char.equals(c2, c1));
    // Only sort by position!
    t.is(Char.compare(c1, c2), 0);
    t.is(Char.compare(c2, c1), 0);
});

test('generate position between: basic case', t => {
    const site = 4;
    const p1 = positions([[0, 0]]);
    const p2 = positions([[Decimal.DIVISOR, 5]]);
    const expected = positions([[1, 4]]);
    t.deepEqual(Char.generatePositionBetween(p1, p2, site), expected);
});

test('generate position between: need new digit', t => {
    const site = 4;
    const p1 = positions([[0, 0]]);
    const p2 = positions([[Decimal.DIVISOR / 2, 5]]);
    const expected = positions([[0, 0], [Decimal.BASE / 2, 4]]);
    t.deepEqual(Char.generatePositionBetween(p1, p2, site), expected);
});

test('generate position between: one mismatched digit (first)', t => {
    const site = 4;
    const p1 = positions([[0, 0], [1, 0]]);
    const p2 = positions([[Decimal.DIVISOR / 2, 5]]);
    const expected = positions([[0, 0], [Decimal.BASE / 2, 4]]);
    t.deepEqual(Char.generatePositionBetween(p1, p2, site), expected);
});

test('generate position between: two mismatched digits (first)', t => {
    const site = 4;
    const p1 = positions([[0, 0], [0, 0], [1, 0]]);
    const p2 = positions([[Decimal.DIVISOR / 2, 5]]);
    const expected = positions([[0, 0], [Decimal.BASE / 2, 4], [0, 4]]);
    t.deepEqual(Char.generatePositionBetween(p1, p2, site), expected);
});

test('generate position between: one mismatched digit (second)', t => {
    const site = 4;
    const p1 = positions([[0, 0]]);
    const p2 = positions([[Decimal.DIVISOR / 2, 5], [1, 5]]);
    const expected = positions([[0, 0], [Decimal.BASE / 2, 4]]);
    t.deepEqual(Char.generatePositionBetween(p1, p2, site), expected);
});

test('generate position between: two mismatched digits (second)', t => {
    const site = 4;
    const p1 = positions([[0, 0]]);
    const p2 = positions([[Decimal.DIVISOR / 2, 5], [0, 5], [1, 5]]);
    const expected = positions([[0, 0], [Decimal.BASE / 2, 4], [0, 4]]);
    t.deepEqual(Char.generatePositionBetween(p1, p2, site), expected);
});