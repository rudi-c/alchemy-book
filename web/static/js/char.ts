import * as Decimal from "./decimal";

import { cons, head, rest } from "./utils";

export namespace Identifier {
    export interface t {
        pos: number;
        site: number;
    }

    export function create(pos: number, site: number): t {
        const obj = { pos, site };
        Object.freeze(obj);
        return obj;
    }

    export function ofArray(array: [number, number]): t {
        return create(array[0], array[1]);
    }

    export function toArray(identifier: t): [number, number] {
        return [identifier.pos, identifier.site];
    }

    export function compare(i1: Identifier.t, i2: Identifier.t) {
        if (i1.pos < i2.pos) {
            return -1;
        } else if (i1.pos > i2.pos) {
            return 1;
        } else {
            if (i1.site < i2.site) {
                return -1;
            } else if (i1.site > i2.site) {
                return 1;
            } else {
                return 0;
            }
        }
    }

    export function equals(i1: Identifier.t, i2: Identifier.t): boolean {
        return i1.pos === i2.pos && i1.site === i2.site;
    }
}

export interface t {
    position: Identifier.t[];
    lamport: number;
    value: string;
}

export type Serial = [Array<[number, number]>, number, string];

export function create(position: Identifier.t[], lamport: number, value: string) {
    const obj = { position, lamport, value };
    Object.freeze(obj);
    return obj;
}

export function startOfFile(): t {
    // Note that the digit is 1, not 0. We don't want the min to be 0
    // because we don't want the last digit to be 0, since fractions
    // would have multiple representations (e.g. 0.1 === 0.10) which
    // would be bad.
    return create([Identifier.create(1, 0)], 0, "^");
}

export function endOfFile(): t {
    return create([Identifier.create(255, 0)], 0, "$");
}

export function ofArray(array: Serial): t {
    return create(array[0].map(Identifier.ofArray), array[1], array[2]);
}

export function toArray(obj: t): Serial {
    const position = obj.position.map(Identifier.toArray);
    return [position, obj.lamport, obj.value];
}

export function comparePosition(c1: Identifier.t[], c2: Identifier.t[]): number {
    for (let i = 0; i < Math.min(c1.length, c2.length); i++) {
        const comp = Identifier.compare(c1[i], c2[i]);
        if (comp !== 0) {
            return comp;
        }
    }
    if (c1.length < c2.length) {
        return - 1;
    } else if (c1.length > c2.length) {
        return 1;
    } else {
        return 0;
    }
}

export function compare(c1: t, c2: t): number {
    return comparePosition(c1.position, c2.position);
}

// Generate a position between p1 and p2. The generated position will be heavily
// biased to lean towards the left since character insertions tend to happen on
// the right side.
export function generatePositionBetween(p1: Identifier.t[], p2: Identifier.t[],
                                        site: number): Identifier.t[] {
    const head1 = head(p1) || Identifier.create(0, site);
    const head2 = head(p2) || Identifier.create(Decimal.BASE, site);

    if (head1.pos === head2.pos) {
        if (head1.site < head2.site) {
            return cons(head1, generatePositionBetween(rest(p1), [], site));
        } else if (head1.site === head2.site) {
            return cons(head1, generatePositionBetween(rest(p1), rest(p2), site));
        } else {
            throw new Error("invalid site ordering");
        }
    } else {
        const n1 = p1.map(ident => ident.pos);
        const n2 = p2.map(ident => ident.pos);
        const delta = Decimal.subtractGreaterThan(n2, n1);

        const next = Decimal.increment(n1, delta);
        return next.map((digit, index) => {
            if (index === next.length - 1) {
                return Identifier.create(digit, site);
            } else if (digit === n1[index]) {
                return Identifier.create(digit, p1[index].site);
            } else if (digit === n2[index]) {
                return Identifier.create(digit, p2[index].site);
            } else {
                return Identifier.create(digit, site);
            }
        });
    }
}

export function equals(c1: t, c2: t): boolean {
    if (c1.position.length !== c2.position.length) return false;
    if (c1.lamport !== c2.lamport) return false;
    if (c1.value !== c2.value) return false;
    for (let i = 0; i < c1.position.length; i++) {
        if (!Identifier.equals(c1.position[i], c2.position[i])) return false;
    }
    return true;
}
