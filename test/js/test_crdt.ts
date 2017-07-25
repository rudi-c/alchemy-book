import test from "ava"
import { List } from "immutable";

import * as Crdt from "../../web/static/js/crdt"

function binarySearch(item: number, behavior: "at" | "before"): number {
    const bsearchList = List([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    return Crdt.binarySearch(bsearchList, item, (a, b) => a - b, behavior);
}

test("binary search: found", t => {
    for (let i = 0; i <= 10; i++) {
        t.is(binarySearch(i, "at"), i);
        t.is(binarySearch(i, "before"), i);
    }
});

test("binary search: not found", t => {
    for (let i = 0; i <= 11; i++) {
        t.is(binarySearch(i - 0.5, "at"), i);
        t.is(binarySearch(i - 0.5, "before"), i - 1);
    }
});