import { InstructionSizes } from './cpu.constants';
import { Memory } from './memory';

interface ICpuRegisters {
    A: number;
    X: number;
    Y: number;
    P: number;
    S: number;
    PC: number;
}

/* eslint-disable */
enum CpuStatusBitPositions {
    Carry = 0,
    Zero = 1,
    IrqDisable = 2,
    DecimalMode = 3,
    BrkCausesIrq = 4,
    UnusedBit5 = 5,
    Overflow = 6,
    Negative = 7
};

function read16(memory: Memory, address: number) {
    const lo = memory.get(address);
    const hi = memory.get(address + 1);

    return ((hi << 8) | lo) & 0xFFFF;
}

function read16Bug(memory: Memory, address: number) {
    const a = address;

    const bHi = a & 0xFF00;
    const bLo = (a + 1) & 0xFF;
    const b = bHi | bLo;

    const effLo = memory.get(a);
    const effHi = memory.get(b);

    const effAddress = ((effHi << 8) | effLo) & 0xFFFF;

    return effAddress;
}
/* eslint-enable */

export default class Cpu {
    private _running: boolean;

    private _cpuRegisters: ICpuRegisters;

    private _memory: Memory;

    constructor() {
        this._cpuRegisters = {
            A: 0,
            X: 0,
            Y: 0,
            P: 0,
            S: 0,
            PC: 0
        };
        this._memory = new Memory();
        this._running = true;
    }

    private get A() {
        return this._cpuRegisters.A;
    }

    private get X() {
        return this._cpuRegisters.X;
    }

    private get Y() {
        return this._cpuRegisters.Y;
    }

    private get P() {
        return this._cpuRegisters.P;
    }

    private get S() {
        return this._cpuRegisters.S;
    }

    private get PC() {
        return this._cpuRegisters.PC;
    }

    private set A(value: number) {
        this._cpuRegisters.A = value & 0xFF;
    }

    private set X(value: number) {
        this._cpuRegisters.X = value & 0xFF;
    }

    private set Y(value: number) {
        this._cpuRegisters.Y = value & 0xFF;
    }

    private set P(value: number) {
        this._cpuRegisters.P = value & 0xFF;
    }

    private set S(value: number) {
        this._cpuRegisters.S = value & 0xFFFF;
    }

    private set PC(value: number) {
        this._cpuRegisters.PC = value & 0xFFFF;
    }

    private _setStatus(field: CpuStatusBitPositions) {
        this.P |= (1 << field);
    }

    private _clearStatus(field: CpuStatusBitPositions) {
        this.P &= ~(1 << field);
    }

    private _isStatusFieldSet(field: CpuStatusBitPositions) {
        return (this.P & (1 << field)) > 0;
    }

    private _stackPush(data: number) {
        this._memory.set(0x100 | this.S, data);
        this.S--;
    }

    private _stackPull() {
        this.S++;
        return this._memory.get(0x100 | this.S);
    }

    public step() {
        while (this._running) {
            const op = this.PC;

            // TODO: Get the operands from the address
            // in memory based on the addressing mode.

            this.PC += InstructionSizes[op];
        }
    }
}
