export interface t {
    digit: number;
    site: number;
}

export function create(digit: number, site: number): t {
    const obj = { digit, site };
    Object.freeze(obj);
    return obj;
}

export function ofArray(array: [number, number]): t {
    return create(array[0], array[1]);
}

export function toArray(identifier: t): [number, number] {
    return [identifier.digit, identifier.site];
}

export function compare(i1: t, i2: t) {
    if (i1.digit < i2.digit) {
        return -1;
    } else if (i1.digit > i2.digit) {
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

export function equals(i1: t, i2: t): boolean {
    return i1.digit === i2.digit && i1.site === i2.site;
}
