import test from "ava"

import * as Decimal from "../../web/static/js/decimal"

const BASE = Decimal.BASE;
const DIVISOR = Decimal.DIVISOR;

test('needs new digit', t => {
    t.true(Decimal.needsNewDigit([0], DIVISOR));
    t.true(Decimal.needsNewDigit([DIVISOR - 1], DIVISOR));
    t.false(Decimal.needsNewDigit([DIVISOR], DIVISOR));
    t.false(Decimal.needsNewDigit([255], DIVISOR));
});

test('match digits: same', t => {
    const n1 = [0];
    const n2 = [37];
    Decimal.matchDigits(n1, n2);
    t.deepEqual(n1, [0]);
    t.deepEqual(n2, [37]);
});

test('match digits: not matching', t => {
    const n1 = [0, 1];
    const n2 = [37];
    Decimal.matchDigits(n1, n2);
    t.deepEqual(n1, [0, 1]);
    t.deepEqual(n2, [37, 0]);
});

test('match digits: not matching', t => {
    const n1 = [0, 1];
    const n2 = [37, 12, 53, 11];
    Decimal.matchDigits(n1, n2);
    t.deepEqual(n1, [0, 1, 0, 0]);
    t.deepEqual(n2, [37, 12, 53, 11]);
});

test('pseudo division', t => {
    // Divison by 0
    t.deepEqual(Decimal.pseudoIntegerDivision([0], DIVISOR), [0]);
    t.deepEqual(Decimal.pseudoIntegerDivision([0, 0], DIVISOR), [0, 0]);

    // Simple division
    t.deepEqual(Decimal.pseudoIntegerDivision([DIVISOR], DIVISOR), [1]);
    t.deepEqual(Decimal.pseudoIntegerDivision([DIVISOR * 5], DIVISOR), [5]);
    t.deepEqual(Decimal.pseudoIntegerDivision([0, DIVISOR], DIVISOR), [0, 1]);
    t.deepEqual(Decimal.pseudoIntegerDivision([DIVISOR, 0], DIVISOR), [1, 0]);
    t.deepEqual(Decimal.pseudoIntegerDivision([DIVISOR, DIVISOR], DIVISOR), [1, 1]);

    // Truncation
    t.deepEqual(Decimal.pseudoIntegerDivision([2], DIVISOR), [0]);
    t.deepEqual(Decimal.pseudoIntegerDivision([0, DIVISOR + 1], DIVISOR), [0, 1]);

    // Carry
    t.deepEqual(Decimal.pseudoIntegerDivision([1, 0], DIVISOR), 
                [0, BASE / DIVISOR]);
    t.deepEqual(Decimal.pseudoIntegerDivision([1, DIVISOR], DIVISOR), 
                [0, BASE / DIVISOR + 1]);
    t.deepEqual(Decimal.pseudoIntegerDivision([BASE - 1, BASE - 1, 1], DIVISOR), 
                [BASE / DIVISOR - 1, BASE - 1, BASE / DIVISOR * (DIVISOR - 1)]);
});

test('add without carry', t => {
    // Most basic addition
    t.deepEqual(Decimal.addNoCarry([0, 0], [0, 0]), [0, 0]);

    // Addition without carry
    t.deepEqual(Decimal.addNoCarry([5, 5], [5, 6]), [5 + 5, 5 + 6]);

    // Addition with carry
    t.deepEqual(Decimal.addNoCarry([BASE - 2, BASE / 2], [0, BASE / 2 + 1]), 
                [BASE - 1, 1]);
});

test('subtract greater than', t => {
    // Most basic subtraction
    t.deepEqual(Decimal.subtractGreaterThan([0, 0], [0, 0]), [0, 0]);

    // Subtraction without carry
    t.deepEqual(Decimal.subtractGreaterThan([11, 4], [3, 2]), [11 - 3, 4 - 2]);

    // Subtraction with carry
    t.deepEqual(Decimal.subtractGreaterThan([11, 2], [3, 4]), [11 - 3 - 1, BASE - 2]);
});