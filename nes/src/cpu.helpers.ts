import { Memory } from './memory';

export function read16(memory: Memory, address: number) {
    const lo = memory.get(address);
    const hi = memory.get(address + 1);

    return ((hi << 8) | lo) & 0xFFFF;
}

export function read16Bug(memory: Memory, address: number) {
    const a = address;

    const bHi = a & 0xFF00;
    const bLo = (a + 1) & 0xFF;
    const b = bHi | bLo;

    const effLo = memory.get(a);
    const effHi = memory.get(b);

    const effAddress = ((effHi << 8) | effLo) & 0xFFFF;

    return effAddress;
}

export function isOverflowOnAdc(first: number, second: number, result: number) {
    return ((first ^ second) & 0x80) === 0 && ((first ^ result) & 0x80) !== 0;
}

export function isOverflowOnSbc(first: number, second: number, result: number) {
    return ((first ^ second) & 0x80) !== 0 && ((first ^ result) & 0x80) !== 0;
}

export function isCarry(first: number, second: number, carry: number, adc: boolean) {
    const modifiedFirst = first & 0xFF;
    const modifiedSecond = second & 0xFF;
    const modifiedCarry = carry & 0xFF;
    if (adc) {
        return modifiedFirst + modifiedSecond + modifiedCarry > 0xFF;
    }

    return modifiedFirst - modifiedSecond - modifiedCarry >= 0;
}
