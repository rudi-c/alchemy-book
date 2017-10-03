import * as Decimal from "./decimal";
import * as Identifier from "./identifier";

import { cons, head, rest } from "./utils";

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

export function comparePosition(p1: Identifier.t[], p2: Identifier.t[]): number {
    for (let i = 0; i < Math.min(p1.length, p2.length); i++) {
        const comp = Identifier.compare(p1[i], p2[i]);
        if (comp !== 0) {
            return comp;
        }
    }
    if (p1.length < p2.length) {
        return - 1;
    } else if (p1.length > p2.length) {
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
export function generatePositionBetween(position1: Identifier.t[],
                                        position2: Identifier.t[],
                                        site: number): Identifier.t[] {
    // Get either the head of the position, or fallback to default value
    const head1 = head(position1) || Identifier.create(0, site);
    const head2 = head(position2) || Identifier.create(Decimal.BASE, site);

    if (head1.digit !== head2.digit) {
        // Case 1: Head digits are different
        // It's easy to create a position to insert in-between by doing regular arithmetics.
        const n1 = Decimal.fromIdentifierList(position1);
        const n2 = Decimal.fromIdentifierList(position2);
        const delta = Decimal.subtractGreaterThan(n2, n1);

        // Increment n1 by some amount less than delta
        const next = Decimal.increment(n1, delta);
        return Decimal.toIdentifierList(next, position1, position2, site);
    } else {
        if (head1.site < head2.site) {
            // Case 2: Head digits are the same, sites are different
            // Since the site acts as a tie breaker, it will always be the case that
            // cons(head1, anything) < position2
            return cons(head1, generatePositionBetween(rest(position1), [], site));
        } else if (head1.site === head2.site) {
            // Case 3: Head digits and sites are the same
            // Need to recurse on the next digits
            return cons(head1, generatePositionBetween(rest(position1), rest(position2), site));
        } else {
            throw new Error("invalid site ordering");
        }
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
