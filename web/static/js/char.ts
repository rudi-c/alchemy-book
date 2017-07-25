import * as Decimal from "./decimal"

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
    return create([Identifier.create(0, 0)], 0, "^");
}

export function endOfFile(): t {
    return create([Identifier.create(Decimal.BASE, 0)], 0, "$");
}

export function ofArray(array: Serial): t {
    return create(array[0].map(Identifier.ofArray), array[1], array[2]);
}

export function toArray(obj: t): Serial {
    const position = obj.position.map(Identifier.toArray);
    return [position, obj.lamport, obj.value];
}

export function compare(c1: t, c2: t): number {
    for (let i = 0; i < Math.min(c1.position.length, c2.position.length); i++) {
        const comp = Identifier.compare(c1.position[i], c2.position[i]);
        if (comp !== 0) {
            return comp;
        }
    }
    if (c1.position.length < c2.position.length) {
        return - 1;
    } else if (c1.position.length > c2.position.length) {
        return 1;
    } else {
        return 0;
    }
}

// Generate a position 1/16th of the way from c1 to c2. The idea is that insertions are going
// to lean very heavily towards the right.
export function generatePositionBetween(p1: Identifier.t[], p2: Identifier.t[], 
                                        site: number): Identifier.t[] {
    const gap = 16;
    const n1 = p1.map(ident => ident.pos);
    const n2 = p2.map(ident => ident.pos);
    Decimal.matchDigits(n1, n2);
    const difference = Decimal.subtractGreaterThan(n2, n1);

    // TODO: handle when there's no difference

    if (Decimal.needsNewDigit(difference, gap)) {
        difference.push(0);
    }

    const offset = Decimal.pseudoIntegerDivision(difference, gap);

    // TODO: add randomness

    Decimal.matchDigits(n1, offset);
    Decimal.matchDigits(n2, offset);
    const newPosition = Decimal.addNoCarry(n1, offset);

    // Pair each digit with a site
    return newPosition.map((digit, index) => {
        if (index === newPosition.length - 1) {
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

export function equals(c1: t, c2: t): boolean {
    if (c1.position.length !== c2.position.length) return false;
    if (c1.lamport !== c2.lamport) return false;
    if (c1.value !== c2.value) return false;
    for (let i = 0; i < c1.position.length; i++) {
        if (!Identifier.equals(c1.position[i], c2.position[i])) return false;
    }
    return true;
}