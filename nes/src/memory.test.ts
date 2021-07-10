import { Memory } from "./memory";

describe('Memory tests', () => {
    it('should initialize correctly', () => {
        const memory = new Memory();

        for (let i = 0; i < 0x10000; i++) {
            expect(memory.get(i)).toBe(0);
        }
    });

    it('should set and get value correctly', () => {
        const memory = new Memory();

        const address = 0xAB;
        const expectedValue = 98;

        memory.set(address, expectedValue);

        expect(memory.get(address)).toBe(expectedValue);
    });

    it('should wrap address and set value correctly', () => {
        const memory = new Memory();

        const address = 0x10011;
        const expectedAddress = 0x11;
        const expectedValue = 95;

        memory.set(address, expectedValue);

        expect(memory.get(expectedAddress)).toBe(expectedValue);
    });

    it('should only set 8 bits for the value', () => {
        const memory = new Memory();

        const address = 0x123;
        const value = 0x199;
        const expectedValue = 0x99;

        memory.set(address, value);
        
        expect(memory.get(address)).toBe(expectedValue);
    });

    it('should write and read properly with mirrored RAM', () => {
        const memory = new Memory();

        const address = 0x100;
        const value = 0x88;

        // Assign the value at the second mirror of RAM
        memory.set(1 * 0x800 + address, value);

        expect(memory.get(address)).toBe(value);
        expect(memory.get(1 * 0x800 + address)).toBe(value);
        expect(memory.get(2 * 0x800 + address)).toBe(value);
    });

    it('should write and read properly to a non-mirroed RAM location in memory space', () => {
        const memory = new Memory();

        const address = 0xC001;
        const value = 0x88;

        // Assign the value at the second mirror of RAM
        memory.set(address, value);

        expect(memory.get(address)).toBe(value);
        expect(memory.get(1 * 0x800 + address)).not.toBe(value);
        expect(memory.get(2 * 0x800 + address)).not.toBe(value);
    });
});
