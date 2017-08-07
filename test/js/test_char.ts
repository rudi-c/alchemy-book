import test from "ava"

import * as Decimal from "../../web/static/js/decimal"
import * as Char from "../../web/static/js/char"

function positions(array: Array<[number, number]>): Char.Identifier.t[] {
    return array.map(Char.Identifier.ofArray);
}

function areIncreasing(positions: Char.Identifier.t[][]): boolean {
    for (let i = 0; i < positions.length - 1; i++) {
        if (Char.comparePosition(positions[i], positions[i + 1]) >= 0) {
            return false;
        }
    }
    return true;
}

test("serialization/deserialization", t => {
    const c: Char.Serial = [
        [[10, 1], [11, 1], [0, 2]],
        24,
        "c"
    ];
    t.deepEqual(c, Char.toArray(Char.ofArray(c)));
});

test("compare and equals: equals", t => {
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

test("compare and equals: site not equal", t => {
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

test("compare and equals: digit not equal", t => {
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

test("compare and equals: lamport not equal", t => {
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

test("generate position between: basic case", t => {
    const site = 4;
    const p1 = positions([[1, 1]]);
    const p2 = positions([[Decimal.DIVISOR, 5]]);
    const generated = Char.generatePositionBetween(p1, p2, site);
    t.true(areIncreasing([p1, generated, p2]));
    t.true(generated[generated.length - 1].site === site);
});

test("generate position between: first digit the same", t => {
    const site = 4;
    const p1 = positions([[1, 1], [1, 1]]);
    const p2 = positions([[1, 1], [Decimal.DIVISOR, 5]]);
    const generated = Char.generatePositionBetween(p1, p2, site);
    t.true(areIncreasing([p1, generated, p2]));
    t.true(generated[generated.length - 1].site === site);
});

test("generate position between: mismatched digits (first)", t => {
    const site = 4;
    [1, site, site + 1].forEach(decimalSite => {
        const p1 = positions([[1, 1]]);
        const p2 = positions([[1, 1], [Decimal.DIVISOR, decimalSite]]);
        const generated = Char.generatePositionBetween(p1, p2, site);
        t.true(areIncreasing([p1, generated, p2]));
        t.true(generated[generated.length - 1].site === site);
    });
});

test("generate position between: mismatched digits (second)", t => {
    const site = 4;
    [1, site, site + 1].forEach(decimalSite => {
        const p1 = positions([[1, 1], [Decimal.DIVISOR, decimalSite]]);
        const p2 = positions([[2, 1]]);
        const generated = Char.generatePositionBetween(p1, p2, site);
        t.true(areIncreasing([p1, generated, p2]));
        t.true(generated[generated.length - 1].site === site);
    });
});

test("generate position between: same positions, different sites", t => {
    const site = 4;
    const p1 = positions([[1, 1]]);
    const p2 = positions([[1, 2]]);
    const generated = Char.generatePositionBetween(p1, p2, site);
    t.true(areIncreasing([p1, generated, p2]));
    t.true(generated[generated.length - 1].site === site);
});

test("generate position between: same positions, different sites, remaining digits not sorted", t => {
    const site = 4;
    const p1 = positions([[1, 1], [10, 1]]);
    const p2 = positions([[1, 2], [1, 1]]);
    const generated = Char.generatePositionBetween(p1, p2, site);
    t.true(areIncreasing([p1, generated, p2]));
    t.true(generated[generated.length - 1].site === site);
});

test("generate position between: increment by a small digit", t => {
    const site = 4;
    const p1 = positions([[Decimal.BASE - 2, site], [1, site]]);
    const p2 = positions([[Decimal.BASE - 1, 0]]);
    const generated = Char.generatePositionBetween(p1, p2, site);
    t.deepEqual(
        Decimal.subtractGreaterThan(p2.map(i => i.pos), p1.map(i => i.pos)), 
        [0, Decimal.BASE - 1]);
    t.deepEqual(generated, positions([[Decimal.BASE - 2, site], [1, site], [1, site]]));
});