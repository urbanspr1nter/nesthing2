import {
    AddressingMode, InstructionCyclesCount, InstructionPageCyclesCount, InstructionSizes,
    InterruptRequestType,
    OpAddressingMode, OpAddressingModeMap
} from './cpu.constants';
import { isCarry, isOverflowOnAdc, isOverflowOnSbc, read16, read16Bug } from './cpu.helpers';
import { Memory } from './memory';

const InterruptVectorLocations = {
    Reset: {
        Low: 0xFFFC,
        High: 0xFFFD
    },
    Nmi: {
        Low: 0xFFFA,
        High: 0xFFFB
    },
    Irq: {
        Low: 0xFFFE,
        High: 0xFFFF
    }
};

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
    Mode: AddressingMode | null;
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

function addressesCrossPageBoundary(a: number, b: number) {
    return (a & 0xFF00) !== (b & 0xFF00);
}

/* eslint-enable */

export default class Cpu {
    private _running: boolean;

    private _cycles: number;

    private _interruptRequest: InterruptRequestType;

    private _cpuRegisters: ICpuRegisters;

    private _memory: Memory;

    private _context: ICpuCycleContext;

    constructor() {
        this._running = true;
        this._cycles = 0;
        this._interruptRequest = InterruptRequestType.None;
        this._cpuRegisters = {
            A: 0,
            X: 0,
            Y: 0,
            P: 0,
            S: 0,
            PC: 0
        };
        this._memory = new Memory();
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

    private _setContextState(address: number, addressingMode: AddressingMode | null) {
        this._context.PC = this.PC;
        this._context.Address = address;
        this._context.Mode = addressingMode;
    }

    private _getStatusBitFlag(bit: CpuStatusBitPositions) {
        return (this.P && (1 << bit)) > 0;
    }

    private _getAddressFromMode(mode: AddressingMode | null) {
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

    private _setNegative(dataByte: number) {
        const modified = dataByte & 0xff;
        if ((modified & 0x80) === 0x80) {
            this._setStatus(CpuStatusBitPositions.Negative);
        } else {
            this._clearStatus(CpuStatusBitPositions.Negative);
        }
    }

    private _setZero(dataByte: number) {
        const modified = dataByte & 0xff;
        if (modified === 0) {
            this._setStatus(CpuStatusBitPositions.Zero);
        } else {
            this._clearStatus(CpuStatusBitPositions.Zero);
        }
    }

    private _addBranchCycles(context: ICpuCycleContext) {
        this._cycles++;
        if (addressesCrossPageBoundary(context.PC, context.Address)) {
            this._cycles++;
        }
    }

    private _compare(a: number, b: number) {
        const xformedA = a & 0xff;
        const xformedB = b & 0xff;
        const result = (xformedA - xformedB) & 0xff;

        this._setZero(result);
        this._setNegative(result);

        if (xformedA >= xformedB) {
            this._setStatus(CpuStatusBitPositions.Carry);
        } else {
            this._clearStatus(CpuStatusBitPositions.Carry);
        }
    }

    /**
     * ADC - Add with Carry
     */
    private _adc() {
        const a = this.A;
        const b = this._memory.get(this._context.Address);
        const carry = this._getStatusBitFlag(CpuStatusBitPositions.Carry) ? 1 : 0;

        this.A = a + b + carry;

        this._setZero(this.A);
        this._setNegative(this.A);

        if (isCarry(a, b, carry, true)) {
            this._setStatus(CpuStatusBitPositions.Carry);
        } else {
            this._clearStatus(CpuStatusBitPositions.Carry);
        }

        if (isOverflowOnAdc(a, b, this.A)) {
            this._setStatus(CpuStatusBitPositions.Overflow);
        } else {
            this._clearStatus(CpuStatusBitPositions.Overflow);
        }
    }

    /**
     * AND - Bitwise AND
     */
    private _and() {
        this.A &= this._memory.get(this._context.Address);
        this._setZero(this.A);
        this._setNegative(this.A);
    }

    /**
     * ASL - Arithmetic Shift Left
     */
    private _asl() {
        let carry: number;
        let result: number;

        if (this._context.Mode === AddressingMode.Accumulator) {
            carry = (this.A >>> 7) & 1;
            this.A <<= 1;
            result = this.A;
        } else {
            const operand = this._memory.get(this._context.Address);
            carry = (operand >>> 7) & 1;
            result = operand << 1;

            this._memory.set(this._context.Address, result);
        }

        if (carry) {
            this._setStatus(CpuStatusBitPositions.Carry);
        } else {
            this._clearStatus(CpuStatusBitPositions.Carry);
        }

        this._setNegative(result);
        this._setZero(result);
    }

    /**
     * BCC - Branch on Carry Cleared
     */
    private _bcc() {
        if (!this._getStatusBitFlag(CpuStatusBitPositions.Carry)) {
            this.PC = this._context.Address;
            this._addBranchCycles(this._context);
        }
    }

    /**
     * BCS - Branch on Carry Set
     */
    private _bcs() {
        if (this._getStatusBitFlag(CpuStatusBitPositions.Carry)) {
            this.PC = this._context.Address;
            this._addBranchCycles(this._context);
        }
    }

    /**
     * BEQ - Branch on Zero Set
     */
    private _beq() {
        if (this._getStatusBitFlag(CpuStatusBitPositions.Zero)) {
            this.PC = this._context.Address;
            this._addBranchCycles(this._context);
        }
    }

    /**
     * BIT - Test overflow and set.
     * Value read from memory is now treated as the status register.
     * However, it does not become the new value of the status register.
     *
     * Side effects: Zero and negative flags are also set from the
     * value passed
     */
    private _bit() {
        const value = this._memory.get(this._context.Address);
        const overflow = (value >> 6) & 1;

        if (overflow > 0) {
            this._setStatus(CpuStatusBitPositions.Overflow);
        } else {
            this._clearStatus(CpuStatusBitPositions.Overflow);
        }

        this._setZero(value & this.A);
        this._setNegative(value);
    }

    /**
     * BMI - Branch if negative
     */
    private _bmi() {
        if (this._getStatusBitFlag(CpuStatusBitPositions.Negative)) {
            this.PC = this._context.Address;
            this._addBranchCycles(this._context);
        }
    }

    /**
     * BNE - Branch if not zero
     */
    private _bne() {
        if (!this._getStatusBitFlag(CpuStatusBitPositions.Zero)) {
            this.PC = this._context.Address;
            this._addBranchCycles(this._context);
        }
    }

    /**
     * BPL - Branch if positive
     */
    private _bpl() {
        if (!this._getStatusBitFlag(CpuStatusBitPositions.Negative)) {
            this.PC = this._context.Address;
            this._addBranchCycles(this._context);
        }
    }

    /**
     * BRK - Force an interrupt
     */
    private _brk() {
        this._stackPush(this.PC >>> 8);
        this._stackPush(this.PC & 0x00ff);
        this._php();
        this._sei();

        const interruptVectorLow = this._memory.get(InterruptVectorLocations.Irq.Low);
        const interruptVectorHigh = this._memory.get(InterruptVectorLocations.Irq.High);

        this.PC = (interruptVectorHigh << 8) | interruptVectorLow;

        this._interruptRequest = InterruptRequestType.None;
    }

    /**
     * BVC - Branch if overflow is cleared
     */
    private _bvc() {
        if (!this._getStatusBitFlag(CpuStatusBitPositions.Overflow)) {
            this.PC = this._context.Address;
            this._addBranchCycles(this._context);
        }
    }

    /**
     * BVS - Branch if overflow is set
     */
    private _bvs() {
        if (this._getStatusBitFlag(CpuStatusBitPositions.Overflow)) {
            this.PC = this._context.Address;
            this._addBranchCycles(this._context);
        }
    }

    /**
     * CLC - Clear carry flag
     */
    private _clc() {
        this._clearStatus(CpuStatusBitPositions.Carry);
    }

    /**
     * CLD - Clead decimal mode flag
     */
    private _cld() {
        this._clearStatus(CpuStatusBitPositions.DecimalMode);
    }

    /**
     * CLI - Clear interrupts disabled flag
     */
    private _cli() {
        this._clearStatus(CpuStatusBitPositions.IrqDisable);
    }

    /**
     * CLV - Clear overflow flag
     */
    private _clv() {
        this._clearStatus(CpuStatusBitPositions.Overflow);
    }

    /**
     * CMP - Compares bytee value in memory against accumulator
     */
    private _cmp() {
        const value = this._memory.get(this._context.Address);
        this._compare(this.A, value);
    }

    /**
     * CPX - Compares byte value in memory against the X index register
     */
    private _cpx() {
        const value = this._memory.get(this._context.Address);
        this._compare(this.X, value);
    }

    /**
     * CPY - Compares byte value in memory against the Y index register
     */
    private _cpy() {
        const value = this._memory.get(this._context.Address);
        this._compare(this.X, value);
    }

    /**
     * DEC - Decrements the value found in memory by 1 and updates it.
     */
    private _dec() {
        const value = this._memory.get(this._context.Address) - 1;
        this._memory.set(this._context.Address, value);
        this._setZero(value);
        this._setNegative(value);
    }

    /**
     * DEX - Decrements the value found in X register by 1
     */
    private _dex() {
        this.X--;
        this._setZero(this.X);
        this._setNegative(this.X);
    }

    /**
     * DEY - Decrements the value found in Y register by 1
     */
    private _dey() {
        this.Y--;
        this._setZero(this.Y);
        this._setNegative(this.Y);
    }

    /**
     * EOR - Bitwise XOR on value found in memory against accumulator
     */
    private _eor() {
        const result = this.A ^ this._memory.get(this._context.Address);
        this.A = result;
        this._setNegative(result);
        this._setZero(result);
    }

    /**
     * INC - Increment the value found in memory by 1 and update it.
     */
    private _inc() {
        const value = this._memory.get(this._context.Address) + 1;
        this._memory.set(this._context.Address, value);
        this._setZero(value);
        this._setNegative(value);
    }

    /**
     * INX - Increments the X index register by 1
     */
    private _inx() {
        this.X++;
        this._setZero(this.X);
        this._setNegative(this.X);
    }

    /**
     * INY - Increments the Y index registery by 1
     */
    private _iny() {
        this.Y++;
        this._setZero(this.Y);
        this._setNegative(this.Y);
    }

    /**
     * JMP - Jump directly to address defined by PC
     */
    private _jmp() {
        this.PC = this._context.Address;
    }

    /**
     * JSR - Jump to subroutine
     */
    private _jsr() {
        const startAddr = this.PC - 1;
        this._stackPush((startAddr & 0xff00) >>> 8);
        this._stackPush(startAddr & 0x00ff);
        this.PC = this._context.Address;
    }

    /**
     * LDA - Load byte value found in memory to the accumulator
     */
    private _lda() {
        this.A = this._memory.get(this._context.Address);
        this._setNegative(this.A);
        this._setZero(this.A);
    }

    /**
     * LDX - Load byte value found in memory to the X index register
     */
    private _ldx() {
        this.X = this._memory.get(this._context.Address);
        this._setNegative(this.X);
        this._setZero(this.X);
    }

    /**
     * LDY - Load byte value found in memory to the Y index register
     */
    private _ldy() {
        this.Y = this._memory.get(this._context.Address);
        this._setNegative(this.Y);
        this._setZero(this.Y);
    }

    /**
     * LSR - Logical shift right
     * Shifts the value in memory 1 bit to the right
     */
    private _lsr() {
        let carry: number;
        let result: number;

        if (this._context.Mode === AddressingMode.Accumulator) {
            carry = this.A & 1;
            this.A >>>= 1;
            result = this.A;
        } else {
            const value = this._memory.get(this._context.Address);
            carry = value & 1;
            result = value >>> 1;
            this._memory.set(this._context.Address, result);
        }

        this._setNegative(result);
        this._setZero(result);

        if (carry === 1) {
            this._setStatus(CpuStatusBitPositions.Carry);
        } else {
            this._clearStatus(CpuStatusBitPositions.Carry);
        }
    }

    /**
     * NOP - No op
     */
    private _nop() {}

    /**
     * ORA - Bitwise OR
     */
    private _ora() {
        this.A |= this._memory.get(this._context.Address);
        this._setNegative(this.A);
        this._setZero(this.A);
    }

    /**
     * PHA - Push accumulator to the stack
     */
    private _pha() {
        this._stackPush(this.A);
    }

    /**
     * PHP - Push status register to the stack
     */
    private _php() {
        this._stackPush(this.P | 0x10);
    }

    /**
     * PLA - Pull from the stack and set accumulator
     */
    private _pla() {
        this.A = this._stackPull();
        this._setNegative(this.A);
        this._setZero(this.A);
    }

    /**
     * PLP - Pull from the stack, and set as the status register
     */
    private _plp() {
        this.P = (this._stackPull() & 0xEF) | 0x20;
    }

    /**
     * ROL - Shift left and set carry bit
     * Shifts the value in memory by 1 bit to the left, and replace
     * LSB with the current carry value. MSB that got replaced is the
     * new carry.
     */
    private _rol() {
        const currCarry = this._getStatusBitFlag(CpuStatusBitPositions.Carry) ? 1 : 0;
        let newCarry: number;
        let result: number;

        if (this._context.Mode === AddressingMode.Accumulator) {
            newCarry = (this.A >>> 7) & 1;
            this.A = (this.A << 1) | currCarry;

            result = this.A;
        } else {
            const value = this._memory.get(this._context.Address);
            newCarry = (value >>> 7) & 1;

            result = (value << 1) | currCarry;

            this._memory.set(this._context.Address, result);
        }

        this._setNegative(result);
        this._setZero(result);

        if (newCarry) {
            this._setStatus(CpuStatusBitPositions.Carry);
        } else {
            this._clearStatus(CpuStatusBitPositions.Carry);
        }
    }

    /**
     * ROR - Shift right and set carry bit
     * Shifts the value in memory by 1 bit to the right, and replaces the
     * MSB with the current carry. The LSB that got replaced will be the new
     * carry value.
     */
    private _ror() {
        const currCarry = this._getStatusBitFlag(CpuStatusBitPositions.Carry) ? 1 : 0;
        let newCarry: number;
        let result: number;

        if (this._context.Mode === AddressingMode.Accumulator) {
            newCarry = this.A & 1;
            this.A = (this.A >>> 1) | (currCarry << 7);

            result = this.A;
        } else {
            const value = this._memory.get(this._context.Address);
            newCarry = value & 1;

            result = (value >>> 1) | (currCarry << 7);

            this._memory.set(this._context.Address, result);
        }

        this._setNegative(result);
        this._setZero(result);

        if (newCarry) {
            this._setStatus(CpuStatusBitPositions.Carry);
        } else {
            this._clearStatus(CpuStatusBitPositions.Carry);
        }
    }

    /**
     * RTI - Return from interrupt
     * Pulls top value from stack, and sets it as the new status register.
     * Then pulls the next two values to build the new address to set to
     * PC.
     */
    private _rti() {
        const newP = (this._stackPull() & 0xEF) | 0x20;
        const pcLow = this._stackPull();
        const pcHigh = this._stackPull();

        this.PC = (pcHigh << 8) | pcLow;
        this.P = newP;
    }

    /**
     * RTS - Return from subroutine
     */
    private _rts() {
        const newLowPC = this._stackPull();
        const newHighPC = this._stackPull();
        this.PC = ((newHighPC << 8) | newLowPC) + 1;
    }

    /**
     * SBC - Subtract with carry
     */
    private _sbc() {
        const a = this.A;
        const b = this._memory.get(this._context.Address);
        const carry = this._getStatusBitFlag(CpuStatusBitPositions.Carry) ? 1 : 0;

        this.A = a - b - (1 - carry);

        this._setZero(this.A);
        this._setNegative(this.A);

        if (isCarry(a, b, 1 - carry, false)) {
            this._setStatus(CpuStatusBitPositions.Carry);
        } else {
            this._clearStatus(CpuStatusBitPositions.Carry);
        }

        if (isOverflowOnSbc(a, b, this.A)) {
            this._setStatus(CpuStatusBitPositions.Overflow);
        } else {
            this._clearStatus(CpuStatusBitPositions.Overflow);
        }
    }

    /**
     * SEC - Set carry bit
     */
    private _sec() {
        this._setStatus(CpuStatusBitPositions.Carry);
    }

    /**
     * SED - Set Decimal Mode
     */
    private _sed() {
        this._setStatus(CpuStatusBitPositions.DecimalMode);
    }

    /**
     * SEI - Set Interrupt disable
     */
    private _sei() {
        this._setStatus(CpuStatusBitPositions.IrqDisable);
    }

    /**
     * STA - Store accumulator value to memory address
     */
    private _sta() {
        this._memory.set(this._context.Address, this.A);
    }

    /**
     * STX - Store X register value to memory address
     */
    private _stx() {
        this._memory.set(this._context.Address, this.X);
    }

    /**
     * STY - Store Y register value to memory address
     */
    private _sty() {
        this._memory.set(this._context.Address, this.Y);
    }

    /**
     * TAX - Transfers accumulator to X register
     */
    private _tax() {
        this.X = this.A;
        this._setNegative(this.X);
        this._setZero(this.X);
    }

    /**
     * TAY - Transfers accumulator to Y register
     */
    private _tay() {
        this.Y = this.A;
        this._setNegative(this.Y);
        this._setZero(this.Y);
    }

    /**
     * TSX - Transfers stack pointer to X register
     */
    private _tsx() {
        this.X = this.S;
        this._setNegative(this.X);
        this._setZero(this.X);
    }

    /**
     * TXA - Transfers X value to accumulator
     */
    private _txa() {
        this.A = this.X;
        this._setNegative(this.A);
        this._setZero(this.A);
    }

    /**
     * TXS - Transfers X value to stack
     */
    private _txs() {
        this.S = this.X;
    }

    /**
     * TYA - Transfers Y value to accumulator
     */
    private _tya() {
        this.A = this.Y;
        this._setNegative(this.A);
        this._setZero(this.A);
    }

    /**
     * Unofficial opcodes
     */
    private _dcp() {}

    private _ign() {}

    private _isb() {}

    private _lax() {}

    private _rla() {}

    private _rra() {}

    private _sax() {}

    private _skb() {}

    private _slo() {}

    private _sre() {}

    private _handleOp(op: number) {
        switch (op) {
            case 0x00:
                this._brk();
                break;
            case 0x01:
            case 0x05:
            case 0x09:
            case 0x0d:
            case 0x11:
            case 0x15:
            case 0x19:
            case 0x1d:
                this._ora();
                break;
            case 0x06:
            case 0x0a:
            case 0x0e:
            case 0x16:
            case 0x1e:
                this._asl();
                break;
            case 0x08:
                this._php();
                break;
            case 0x0c:
            case 0x1c:
            case 0x3c:
            case 0x5c:
            case 0x7c:
            case 0xdc:
            case 0xfc:
            case 0x04:
            case 0x44:
            case 0x64:
            case 0x14:
            case 0x34:
            case 0x54:
            case 0x74:
            case 0xd4:
            case 0xf4:
                this._ign();
                break;
            case 0x10:
                this._bpl();
                break;
            case 0x18:
                this._clc();
                break;
            case 0x20:
                this._jsr();
                break;
            case 0x21:
            case 0x25:
            case 0x29:
            case 0x2d:
            case 0x31:
            case 0x35:
            case 0x39:
            case 0x3d:
                this._and();
                break;
            case 0x24:
            case 0x2c:
                this._bit();
                break;
            case 0x26:
            case 0x2a:
            case 0x2e:
            case 0x36:
            case 0x3e:
                this._rol();
                break;
            case 0x28:
                this._plp();
                break;
            case 0x30:
                this._bmi();
                break;
            case 0x38:
                this._sec();
                break;
            case 0x40:
                this._rti();
                break;
            case 0x41:
            case 0x45:
            case 0x49:
            case 0x4d:
            case 0x51:
            case 0x55:
            case 0x59:
            case 0x5d:
                this._eor();
                break;
            case 0x46:
            case 0x4a:
            case 0x4e:
            case 0x56:
            case 0x5e:
                this._lsr();
                break;
            case 0x48:
                this._pha();
                break;
            case 0x4c:
            case 0x6c:
                this._jmp();
                break;
            case 0x50:
                this._bvc();
                break;
            case 0x58:
                this._cli();
                break;
            case 0x60:
                this._rts();
                break;
            case 0x61:
            case 0x65:
            case 0x69:
            case 0x6d:
            case 0x71:
            case 0x75:
            case 0x79:
            case 0x7d:
                this._adc();
                break;
            case 0x66:
            case 0x6a:
            case 0x6e:
            case 0x76:
            case 0x7e:
                this._ror();
                break;
            case 0x68:
                this._pla();
                break;
            case 0x70:
                this._bvs();
                break;
            case 0x78:
                this._sei();
                break;
            case 0x81:
            case 0x85:
            case 0x8d:
            case 0x91:
            case 0x95:
            case 0x99:
            case 0x9d:
                this._sta();
                break;
            case 0x84:
            case 0x8c:
            case 0x94:
                this._sty();
                break;
            case 0x86:
            case 0x8e:
            case 0x96:
                this._stx();
                break;
            case 0x88:
                this._dey();
                break;
            case 0x8a:
                this._txa();
                break;
            case 0x90:
                this._bcc();
                break;
            case 0x98:
                this._tya();
                break;
            case 0x9a:
                this._txs();
                break;
            case 0xa0:
            case 0xa4:
            case 0xac:
            case 0xb4:
            case 0xbc:
                this._ldy();
                break;
            case 0xa1:
            case 0xa5:
            case 0xa9:
            case 0xad:
            case 0xb1:
            case 0xb5:
            case 0xb9:
            case 0xbd:
                this._lda();
                break;
            case 0xa2:
            case 0xa6:
            case 0xae:
            case 0xb6:
            case 0xbe:
                this._ldx();
                break;
            case 0xa8:
                this._tay();
                break;
            case 0xaa:
                this._tax();
                break;
            case 0xb0:
                this._bcs();
                break;
            case 0xb8:
                this._clv();
                break;
            case 0xba:
                this._tsx();
                break;
            case 0xc0:
            case 0xc4:
            case 0xcc:
                this._cpy();
                break;
            case 0xc1:
            case 0xc5:
            case 0xc9:
            case 0xcd:
            case 0xd1:
            case 0xd5:
            case 0xd9:
            case 0xdd:
                this._cmp();
                break;
            case 0xc6:
            case 0xce:
            case 0xd6:
            case 0xde:
                this._dec();
                break;
            case 0xc8:
                this._iny();
                break;
            case 0xca:
                this._dex();
                break;
            case 0xd0:
                this._bne();
                break;
            case 0xd8:
                this._cld();
                break;
            case 0xe0:
            case 0xe4:
            case 0xec:
                this._cpx();
                break;
            case 0xe1:
            case 0xe5:
            case 0xeb:
            case 0xe9:
            case 0xed:
            case 0xf1:
            case 0xf5:
            case 0xf9:
            case 0xfd:
                this._sbc();
                break;
            case 0xe6:
            case 0xee:
            case 0xf6:
            case 0xfe:
                this._inc();
                break;
            case 0xe8:
                this._inx();
                break;
            case 0x1a:
            case 0x3a:
            case 0x5a:
            case 0x7a:
            case 0xda:
            case 0xfa:
            case 0xea:
                this._nop();
                break;
            case 0x80:
            case 0x82:
            case 0x89:
            case 0xc2:
            case 0xe2:
                this._skb();
                break;
            case 0xf0:
                this._beq();
                break;
            case 0xf8:
                this._sed();
                break;
            case 0xa3:
            case 0xa7:
            case 0xaf:
            case 0xb3:
            case 0xb7:
            case 0xbf:
                this._lax();
                break;
            case 0x83:
            case 0x87:
            case 0x8f:
            case 0x97:
                this._sax();
                break;
            case 0xc3:
            case 0xc7:
            case 0xcf:
            case 0xd3:
            case 0xd7:
            case 0xdb:
            case 0xdf:
                this._dcp();
                break;
            case 0xe3:
            case 0xe7:
            case 0xef:
            case 0xf3:
            case 0xf7:
            case 0xfb:
            case 0xff:
                this._isb();
                break;
            case 0x03:
            case 0x07:
            case 0x0f:
            case 0x13:
            case 0x17:
            case 0x1b:
            case 0x1f:
                this._slo();
                break;
            case 0x23:
            case 0x27:
            case 0x2f:
            case 0x33:
            case 0x37:
            case 0x3b:
            case 0x3f:
                this._rla();
                break;
            case 0x43:
            case 0x47:
            case 0x4f:
            case 0x53:
            case 0x57:
            case 0x5b:
            case 0x5f:
                this._sre();
                break;
            case 0x63:
            case 0x67:
            case 0x6f:
            case 0x73:
            case 0x77:
            case 0x7b:
            case 0x7f:
                this._rra();
                break;
            default:
                break;
        }
    }

    public requestInterrupt(reqType: InterruptRequestType) {
        if (reqType === InterruptRequestType.IRQ
            && this._getStatusBitFlag(CpuStatusBitPositions.IrqDisable)) {
            return;
        }

        this._interruptRequest = reqType;
    }

    public step() {
        const prevCycles = this._cycles;

        if (this._interruptRequest === InterruptRequestType.NMI) {
            // Handle NMI here
        } else if (this._interruptRequest === InterruptRequestType.IRQ
            && !this._getStatusBitFlag(CpuStatusBitPositions.IrqDisable)) {
            // Handle IRQ
        }

        const op = this._memory.get(this.PC);
        const addressingModesMap: OpAddressingModeMap = OpAddressingMode;
        const addressInfo = this._getAddressFromMode(addressingModesMap[op]);

        this.PC += InstructionSizes[op];
        this._cycles += InstructionCyclesCount[op];
        if (addressInfo.pageCrossed) {
            this._cycles += InstructionPageCyclesCount[op];
        }

        this._setContextState(addressInfo.address, addressingModesMap[op]);

        this._handleOp(op);

        return this._cycles - prevCycles;
    }
}
