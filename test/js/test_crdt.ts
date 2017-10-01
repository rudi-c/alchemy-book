import test from "ava"
import { List } from "immutable";

import { binarySearch } from "../../web/static/js/crdt_linear"

function doBinarySearch(item: number, behavior: "at" | "before"): number {
    const bsearchList = List([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    return binarySearch(bsearchList, item, (a, b) => a - b, behavior);
}

test("binary search: found", t => {
    for (let i = 0; i <= 10; i++) {
        t.is(doBinarySearch(i, "at"), i);
        t.is(doBinarySearch(i, "before"), i);
    }
});

test("binary search: not found", t => {
    for (let i = 0; i <= 11; i++) {
        t.is(doBinarySearch(i - 0.5, "at"), i);
        t.is(doBinarySearch(i - 0.5, "before"), i - 1);
    }
});