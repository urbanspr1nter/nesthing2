import { InstructionSizes } from './cpu.constants';
import { Memory } from './memory';

enum AddressingMode {
    Immediate,
    Absolute,
    AbsoluteIndirect,
    DirectPage,
    AbsoluteIndexedX,
    AbsoluteIndexedY,
    DirectPageIndexedX,
    DirectPageIndexedY,
    DirectPageIndexedIndirectX,
    DirectPageIndirectIndexedY,
    Implicit,
    Accumulator,
    Relative
  }
interface ICpuRegisters {
    A: number;
    X: number;
    Y: number;
    P: number;
    S: number;
    PC: number;
}
export interface ICpuCycleContext {
    PC: number;
    Address: number;
    Mode: AddressingMode;
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

function addressesCrossPageBoundary(a: number, b: number) {
    return (a & 0xFF00) !== (b & 0xFF00);
}

/* eslint-enable */

export default class Cpu {
    private _running: boolean;

    private _cpuRegisters: ICpuRegisters;

    private _memory: Memory;

    private _context: ICpuCycleContext;

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

        this._context = {
            PC: this.PC,
            Address: 0,
            Mode: AddressingMode.Immediate
        };
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

    private _setContextState(address: number, addressingMode: AddressingMode) {
        this._context.PC = this.PC;
        this._context.Address = address;
        this._context.Mode = addressingMode;
    }

    private _getAddressFromMode(mode: AddressingMode) {
        let address = 0;
        let pageCrossed = false;

        switch (mode) {
            case AddressingMode.Immediate:
                address = this.PC + 1;
                break;
            case AddressingMode.Absolute:
                address = read16(this._memory, this.PC + 1);
                break;
            case AddressingMode.AbsoluteIndirect:
                address = read16Bug(this._memory, read16(this._memory, this.PC + 1));
                break;
            case AddressingMode.DirectPage:
                address = this._memory.get(this.PC + 1) & 0xFF;
                break;
            case AddressingMode.AbsoluteIndexedX:
                address = read16(this._memory, this.PC + 1) + this.X;
                pageCrossed = addressesCrossPageBoundary(address - this.Y, address);
                break;
            case AddressingMode.AbsoluteIndexedY:
                address = read16(this._memory, this.PC + 1) + this.Y;
                pageCrossed = addressesCrossPageBoundary(address - this.Y, address);
                break;
            case AddressingMode.DirectPageIndexedX:
                address = (this._memory.get(this.PC + 1) + this.X) & 0xFF;
                break;
            case AddressingMode.DirectPageIndexedY:
                address = (this._memory.get(this.PC + 1) + this.Y) & 0xFF;
                break;
            case AddressingMode.DirectPageIndexedIndirectX:
                address = read16Bug(this._memory, (this._memory.get(this.PC + 1) + this.X) & 0xFF);
                break;
            case AddressingMode.DirectPageIndirectIndexedY:
                address = read16Bug(this._memory, (this._memory.get(this.PC + 1))) + this.Y;
                pageCrossed = addressesCrossPageBoundary(address - this.Y, address);
                break;
            case AddressingMode.Relative:
                const offset = this._memory.get(this.PC + 1);
                if (offset < 0x80) {
                    address = this.PC + 2 + offset;
                } else {
                    address = this.PC + 2 + offset - 0x100;
                }
                break;
            case AddressingMode.Accumulator:
            case AddressingMode.Implicit:
            default:
                address = 0;
                break;
        }

        return {
            address: address & 0xFFFF,
            pageCrossed
        };
    }

    public step() {
        while (this._running) {
            const op = this._memory.get(this.PC);

            // TODO: Get the operands from the address
            // in memory based on the addressing mode.

            this.PC += InstructionSizes[op];
        }
    }
}
