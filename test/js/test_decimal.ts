import test from "ava";

import * as Decimal from "../../web/static/js/decimal";

const BASE = Decimal.BASE;
const DIVISOR = Decimal.DIVISOR;

// Return true if the decimal digits a are greater than
// the decimal digits b.
function isGreater(a: number[], b: number[]): boolean {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
        if (a[i] > b[i]) {
            return true;
        } else if (a[i] < b[i]) {
            return false;
        }
    }

    // If we"re here, the digits have been equal so far.
    return a.length > b.length;
}

test("add without carry", t => {
    // Most basic addition
    t.deepEqual(Decimal.add([0, 0], [0, 0]), [0, 0]);

    // Addition without carry
    t.deepEqual(Decimal.add([5, 5], [5, 6]), [5 + 5, 5 + 6]);

    // Addition with carry
    t.deepEqual(Decimal.add([BASE - 2, BASE / 2], [0, BASE / 2 + 1]),
                [BASE - 1, 1]);
});

test("subtract greater than", t => {
    // Most basic subtraction
    t.deepEqual(Decimal.subtractGreaterThan([0, 0], [0, 0]), [0, 0]);

    // Subtraction without carry
    t.deepEqual(Decimal.subtractGreaterThan([11, 4], [3, 2]), [11 - 3, 4 - 2]);

    // Subtraction with carry
    t.deepEqual(Decimal.subtractGreaterThan([11, 2], [3, 4]), [11 - 3 - 1, BASE - 2]);

    // Subtraction with carry and different number of digits
    t.deepEqual(Decimal.subtractGreaterThan([1], [0, 1]), [0, BASE - 1]);
});

test("increment: test necessary properties", t => {
    function incrementAssertCorrect(old: number[], delta: number[]) {
        const incremented = Decimal.increment(old, delta);

        t.true(isGreater(incremented, old));
        t.true(incremented[incremented.length - 1] !== 0);

        t.true(isGreater(
            Decimal.add([0].concat(old), [0].concat(delta)),
            [0].concat(incremented),
        ));
    }

    [[1], [0, 1], [0, 0, 1]].forEach(delta => {
        incrementAssertCorrect([1], delta);
        incrementAssertCorrect([0, 1], delta);
        incrementAssertCorrect([0, 0, 1], delta);
        incrementAssertCorrect([BASE - 1], delta);
        incrementAssertCorrect([0, BASE - 1], delta);
        incrementAssertCorrect([BASE - 2, BASE - 1], delta);
    });
});

test("increment: test that a smaller digit is used to be added", t => {
    t.deepEqual(Decimal.increment([1], [1]), [1, 1]);
    t.deepEqual(Decimal.increment([1], [0, 1]), [1, 0, 1]);
});
