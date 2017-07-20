import * as Immutable from 'immutable'

export module Crdt {
    export type t = [[number, number], string][]

    export function to_string(crdt: t) {
        return crdt.map(elem => {
            const [_, char] = elem;
            return char;
        }).join("");
    }
}