export const BASE = 256;
export const DIVISOR = 16;

// Calculate (n1 - n2) where n1 > n2
export function subtractGreaterThan(n1: number[], n2: number[]): number[] {
    let carry = 0;
    const diff: number[] = Array(Math.max(n1.length, n2.length));
    for (let i = diff.length - 1; i >= 0; i--) {
        const d1 = (n1[i] || 0) - carry;
        const d2 = (n2[i] || 0);
        if (d1 < d2) {
            carry = 1;
            diff[i] = d1 + BASE - d2;
        } else {
            carry = 0;
            diff[i] = d1 - d2;
        }
    }
    return diff;
}

// Pad n1 and n2 with 0s at the end such that they have the same
// number of digits.
export function matchDigits(n1: number[], n2: number[]): [number[], number[]] {
    const new1 = n1.slice();
    const new2 = n2.slice();
    for (let i = n1.length; i < n2.length; i++) {
        new1.push(0);
    }
    for (let i = n2.length; i < n1.length; i++) {
        new2.push(0);
    }
    return [new1, new2];
}

// Calculate (n1 + n2) where we are guaranteed that (n1 + n2)
// will not "overflow" (need more digits)
export function addNoCarry(n1: number[], n2: number[]): number[] {
    let carry = 0;
    const diff: number[] = Array(n1.length);
    for (let i = n1.length - 1; i >= 0; i--) {
        const sum = n1[i] + n2[i] + carry;
        carry = Math.floor(sum / BASE);
        diff[i] = (sum % BASE);
    }
    if (carry !== 0) {
        throw new Error("there should be no carry: " + n1 + " + " + n2);
    }
    return diff;
}

// Increment n1 by a value much smaller than delta, in such a way
// that the last digit of the result is not zero.
export function increment(n1: number[], delta: number[]): number[] {
    const firstNonzeroDigit = delta.findIndex(x => x !== 0);
    const inc = delta.slice(0, firstNonzeroDigit).concat([0, 1]);

    const [v0, incPadded] = matchDigits(n1, inc);

    const v1 = addNoCarry(v0, incPadded);
    const v2 = v1[v1.length - 1] === 0 ? addNoCarry(v1, incPadded) : v1;
    return v2;
}
