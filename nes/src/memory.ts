const MaxAddress = 0x10000;

export class Memory {
    private _memory: number[];

    constructor() {
        this._memory = [];

        for (let i = 0; i < MaxAddress; i++) {
            this._memory.push(0);
        }
    }

    public set(address: number, value: number) {
        const cleanedAddress = Memory._cleanAddress(address);
        const cleanedValue = Memory._cleanValue(value);

        this._memory[cleanedAddress] = cleanedValue;
    }

    public get(address: number) {
        const cleanedAddress = Memory._cleanAddress(address);

        return this._memory[cleanedAddress];
    }

    private static _cleanAddress(address: number) {
        return address & 0xFFFF;
    }

    private static _cleanValue(value: number) {
        return value & 0xFF;
    }
}
