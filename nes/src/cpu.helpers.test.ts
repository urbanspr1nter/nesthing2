import {
    read16Bug,
    read16,
    isCarry,
    isOverflowOnSbc,
    isOverflowOnAdc
  } from "./cpu.helpers";
  
describe("cpu.helpers tests", () => {
    it("should simulate wraparound bug - wrap around low byte without incrementing high byte", () => {
        const memory = {
            get: jest.fn().mockImplementation((param: number) => {
                const mockMemory = { 0x11ff: 0, 0x1200: 1, 0x1100: 2 } as {[key: number]: number};

                return mockMemory[param];
            })
        };

        const address = 0x11ff;
        const result = read16Bug(memory as any, address);

        expect(memory.get).toHaveBeenNthCalledWith(1, 0x11ff);
        expect(memory.get).toHaveBeenNthCalledWith(2, 0x1100);
        expect(result).toBe(0x0200);
    });

    it("should read 2 bytes from memory to form an effective address", () => {
        const memory = {
            get: jest.fn().mockImplementation((param: number) => {
                const mockMemory = {
                    0x1000: 0,
                    0x1001: 2,
                    0x1002: 3,
                    0x10ff: 4,
                    0x1100: 5
                } as {[key: number]: number};
                return mockMemory[param];
            })
        };

        let address = 0x1000;
        let result = read16(memory as any, address);
        expect(result).toBe(0x0200);

        address = 0x10ff;
        result = read16(memory as any, address);
        expect(result).toBe(0x0504);
    });

    it("should carry on addition when carry not set", () => {
        const first = 0xfe;
        const second = 0x02;
        const carry = 0;

        expect(isCarry(first, second, carry, true)).toBe(true);
    });

    it("should carry on addition when carry is set", () => {
        const first = 0xfe;
        const second = 0x1;
        const carry = 1;

        expect(isCarry(first, second, carry, true)).toBe(true);
    });

    it("should not carry on addition when carry not set", () => {
        const first = 0xfe;
        const second = 0x1;
        const carry = 0;

        expect(isCarry(first, second, carry, true)).toBe(false);
    });

    it("should not carry on addition when carry is set", () => {
        const first = 0xfd;
        const second = 0x1;
        const carry = 0x1;

        expect(isCarry(first, second, carry, true)).toBe(false);
    });

    it("should carry on subtraction when carry not set", () => {
        const first = 0xf0;
        const second = 0xef;
        const carry = 0x0;

        expect(isCarry(first, second, carry, false)).toBe(true);
    });

    it("should carry on subtraction when carry is set", () => {
        const first = 0xf0;
        const second = 0xef;
        const carry = 0x1;

        expect(isCarry(first, second, carry, false)).toBe(true);
    });

    it("should carry on subtraction when carry is not set", () => {
        const first = 0xf0;
        const second = 0xf1;
        const carry = 0x0;

        expect(isCarry(first, second, carry, false)).toBe(false);
    });

    it("should carry on subtraction when carry is set", () => {
        const first = 0xf0;
        const second = 0xf0;
        const carry = 0x1;

        expect(isCarry(first, second, carry, false)).toBe(false);
    });

    it("should overflow on subtraction: pos - neg = neg", () => {
        const first = 3;
        const second = -126;
        const borrow = 0;
        const final = first - second - borrow;

        expect(isOverflowOnSbc(first, second, final)).toBe(true);
    });

    it("should overflow on subtraction: neg - pos = pos", () => {
        const first = -3;
        const second = 127;
        const borrow = 0;
        const final = first - second - borrow;

        expect(isOverflowOnSbc(first, second, final)).toBe(true);
    });

    it("should not overflow on subtraction: pos - pos = pos", () => {
        const first = 120;
        const second = 100;
        const borrow = 0;
        const final = first - second - borrow;

        expect(isOverflowOnSbc(first, second, final)).toBe(false);
    });

    it("should not overflow on subtraction: neg - neg = neg", () => {
        const first = -125;
        const second = -2;
        const borrow = 0;
        const final = first - second - borrow;

        expect(isOverflowOnSbc(first, second, final)).toBe(false);
    });

    it("should not overflow on subtraction: pos - neg = pos", () => {
        const first = 100;
        const second = -3;
        const borrow = 0;
        const final = first - second - borrow;

        expect(isOverflowOnSbc(first, second, final)).toBe(false);
    });

    it("should not overflow on subtraction: neg - pos = neg", () => {
        const first = -100;
        const second = 3;
        const borrow = 0;
        const final = first - second - borrow;

        expect(isOverflowOnSbc(first, second, final)).toBe(false);
    });

    it("should not overflow on subtraction: neg - neg = pos", () => {
        const first = -100;
        const second = -103;
        const borrow = 0;
        const final = first - second - borrow;

        expect(isOverflowOnSbc(first, second, final)).toBe(false);
    });

    it("should not overflow on subtraction: pos - pos = neg", () => {
        const first = 100;
        const second = 103;
        const borrow = 0;
        const final = first - second - borrow;

        expect(isOverflowOnSbc(first, second, final)).toBe(false);
    });

    it("should check for addition overflow", () => {
        for (let carry = 0; carry <= 1; carry++) {
            for (let a = 0; a <= 0xff; a++) {
                for (let b = 0; b <= 0xff; b++) {
                const result = (a + b + carry) & 0xff;
                if (a <= 0x7f && b <= 0x7f && result >= 0x80) {
                    expect(isOverflowOnAdc(a, b, result)).toBe(true);
                } else if (a >= 0x80 && b >= 0x80 && result <= 0x7f) {
                    expect(isOverflowOnAdc(a, b, result)).toBe(true);
                } else {
                    expect(isOverflowOnAdc(a, b, result)).toBe(false);
                }
                }
            }
        }
    });

    it("should check for subtraction overflow", () => {
        for (let carry = 0; carry <= 1; carry++) {
            for (let a = 0; a <= 0xff; a++) {
                for (let b = 0; b <= 0xff; b++) {
                const result = (a - b - (1 - carry)) & 0xff;
                if (a <= 0x7f && b >= 0x80 && result >= 0x80) {
                    expect(isOverflowOnSbc(a, b, result)).toBe(true);
                } else if (a >= 0x80 && b <= 0x7f && result <= 0x7f) {
                    expect(isOverflowOnSbc(a, b, result)).toBe(true);
                } else {
                    expect(isOverflowOnSbc(a, b, result)).toBe(false);
                }
                }
            }
        }
    });
});