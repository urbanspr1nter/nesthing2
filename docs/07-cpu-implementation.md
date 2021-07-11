# CPU Implementation in Detail

## Cycle-for-Cycle Execution

The goal is to implement a CPU which can operate cycle-for-cycle. This means being able to keep track of some CPU state in-between instructions. 

Context helps and maintaining some property values will be useful:

1. The current `PC` value.
2. The current address the instruction is operating within on that cycle.
3. The current addressing mode for the instruction.

A simple interface definition can suffice:

```
interface ICpuCycleContext {
  PC: number;
  Address: number;
  Mode: AddressingModes;
}
```

Then we can declare instance variable containing an object with this shape reflecting the current state of the CPU at a particular cycle is helpful.

For each cycle, a helper method can be used to set the current state:

```
private _setContextState(address: number, addressingMode: AddressingMode) {
    this._context.PC = this.PC;
    this._context.Address = address;
    this._context.Mode = addressingMode;
}
```

For performance reasons, it is better to just set the properties rather than recreate the object at every single cycle. 

Then for each cycle of execution, the method `_setContextState` can be called with the most up to date data.

## Evaluating Effective Addresses

Since now we can maintain the current memory address across cycles, how can we evaluate effective addresses of the available (14) addressing modes?

Let's take a tour of each of the 14 addressing modes and implement them individually.

Before we begin, I will be clear that the `_getAddressFromMode` helper method will contain the evaluation of the effective address, given an address mode. The base address can be retrieved from the `PC` register itself.

```
private _getAddressFromMode(mode: AddressingMode) {
    let address = 0;

    switch (mode) {
        case AddressingMode.Immediate:
            break;
        case AddressingMode.Absolute:
            break;
        case AddressingMode.AbsoluteIndirect:
            break;
        case AddressingMode.DirectPage:
            break;
        case AddressingMode.AbsoluteIndexedX:
            break;
        case AddressingMode.AbsoluteIndexedY:
            break;
        case AddressingMode.DirectPageIndexedX:
            break;
        case AddressingMode.DirectPageIndexedY:
            break;
        case AddressingMode.DirectPageIndexedIndirectX:
            break;
        case AddressingMode.DirectPageIndirectIndexedY:
            break;
        case AddressingMode.Relative:
            break;
        case AddressingMode.Accumulator:
        case AddressingMode.Implicit:
        default:
            address = 0;
            break;
    }

    return address & 0xFFFF;
}
```

### What is the Current PC?

Pop quiz, what's the current PC value? The current PC value is actually the current location in memory, the opcode of the current instruction. The memory address will usually follow this PC value. 

So, when evaluating address modes, the address offset to be used is actually `PC+ 1`, or the address immediately following the opcode address.

### AddressingMode.Immediate

This one is an easy one, the address is simply the 16 bit number in the PC location + 1.

```
address = this.PC + 1;
```

### AddressingMode.Absolute

This address is the 16-bit effective address which is obtained from the address starting at `PC + 1`.

We can use the `read16` helper method to read the 16 bit address, starting with the low byte first, and then the high byte.

```
address = read16(this._memory, this.PC + 1)
```

### AddressingMode.AbsoluteIndirect

> **Important** This is an indirect addressing mode, so the "read 16 bug" applies.

1. Reads the indirect address by finding the 16 bit address in memory pointed by `PC + 1`. (read16)
2. Takes the indirect address, and reads 16 bits starting at that indirect address to obtain the effective address (read16Bug)

```
address = read16Bug(this._memory, read16(this._memory, this.PC + 1));
```

### AddressingMode.DirectPage

Directly reads the lower 8 bits found in the memory address stored in `PC + 1` as the effective memory address.

```
address = this._memory.get(this.PC + 1) & 0xFF;
```

### AddressingMode.AbsoluteIndexedX

Performs the same operate as absolute addressing, but also adds the value found in the X register to obtain the effective memory address.

```
address = read16(this._memory, this.PC + 1) + this.X;
```

### AddressingMode.AbsoluteIndexedY

Performs the same operate as absolute addressing, but also adds the value found in the Y register to obtain the effective memory address.

```
address = read16(this._memory, this.PC + 1) + this.Y;
```
### AddressingMode.DirectPageIndexedX

Similar to Direct Page addressing but with the value found in the X register added to the memory address found to obtain effective address.

```
address = (this._memory.get(this.PC + 1) + this.X) & 0xFF;
```

### AddressingMode.DirectPageIndexedY

Similar to Direct Page addressing but with the value found in the Y register added to the memory address found to obtain effective address.

```
address = (this._memory.get(this.PC + 1) + this.Y) & 0xFF;
```

### AddressingMode.DirectPageIndexedIndirectX

First find the base address in the given memory location by the PC register, then add an offset with the value stored in the X register to obtain the effective address in memory, and read from that location.

The indirect bug applies here.

```
address = read16Bug(this._memory, (this._memory.get(this.PC + 1) + this.X) & 0xFF);
```

### AddressingMOde.DirectPageIndirectIndexedY:

Find the base address in the given memory location by the PC register. This is automatically the effective address. Then add the value in the Y register to obtain the effective address.

The indirect bug pplies here.

```
address = read16Bug(this._memory, (this._memory.get(this.PC + 1))) + this.Y;
```

### AddressingMode.Relative:

Obtain the offset given by the value located in `PC + 1`. Then use this offset to calculate the address from `PC + 2`. Note that there is wrap-around here.

```
const offset = this._memory.get(this.PC + 1);
if (offset < 0x80) {
    address = this.PC + 2 + offset;
} else {
    address = this.PC + 2 + offset - 0x100;
}
```

## Page Boundary Crossings

Knowing that reading/writing to a specific address whether page boundary is crossed is very important to keeping track of the number of cycles.

Remember, a **page** is 256 bytes. That means if the 16 bit starting address has the high byte as being different from the end address, then the page has been crossed. 

Therefore, we can have a helper method to determine this:

```
function _addressesCrossPageBoundary(a: number, b: number) {
    return (a & 0xFF00) !== (b & 0xFF00);
}
```

Then it can be used with the following addressing modes:

* Absolute Indexed with X
* Absolute Indexed with Y
* Direct Page Indirect Indexed Y

## Cycle Counting

Since we are on the topic of cycle counting, the CPU will need to keep track of the number of current cycles.

It will just be an instance variable `_cycles` which is initially `0` when the CPU is created.

## Step Function

The CPU exposes a public method called `step` that will run a single instruction in memory.

What is returned are the number of cycles that was executed for that instruction.

Now we can rewrite the main `step` function to behave like:

```
public step() {
    const prevCycles = this._cycles;
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
```

At this point, running a single step of the CPU allows:

1. Keeping track of current cycles.
2. Get an op
3. Determine how to interpret the op by finding the address mode, and the instruction size to increment the PC.
4. Determine how many cycles will be needed to execute (including page boundary crossing)
5. Execute the op, with the stubbed method: `_handleOp`.

```
private _handleOp(op: number) {
    console.log('Handling op', op);
    return;
}
```

At this point, execution of interrupts are still not considered... but we will get there next.

## Interrupts

If extra discussion in what interrupts are is needed, then please see the previous section and read about interrupts there.

This section doesn't explain interrupts, but will show how to implement it in the CPU.

In the NES, there are 3 interrupt request types: 

1. Reset
2. NMI
3. IRQ

It can be expressed as an enum for the CPU:

```
enum InterruptRequestType {
    Reset,
    NMI,
    IRQ,
    None
}
```

The CPU will then keep track of what interrupt request is being handled. With its default state being `None`.

A hardcoded constant will also serve as a way to quickly reference the address of the interrupt vector locations (the functions to where the CPU can jump to begin running the interrupt routine)

```
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
```

Any other component that interacts with the CPU can request and interrupt with the function `requestInterrupt`. All that is needed for the parameter is the interrupt request type.

```
public requestInterrupt(reqType: InterruptRequestType) {
    if (reqType === InterruptRequestType.IRQ 
        && this._getStatusBitFlag(CpuStatusBitPositions.IrqDisable)) {
        return;
    }

    this._interruptRequest = reqType;
}
```

Note that the interrupt isn't handled immediately. As it is a **request**, the CPU will receive it and will proceed to handle it upon completion of the instruction.

Then the `step` function can be updated to execute interrupts. Remember that for IRQ interrupts, it should not be executed if the `InterruptDisable` status flag is set.

```
if (this._interruptRequest === InterruptRequestType.NMI) {
    // Handle NMI here
} else if (this._interruptRequest === InterruptRequestType.IRQ
    && !this._getStatusBitFlag(CpuStatusBitPositions.IrqDisable)) {
    // Handle IRQ
}
```

Implementation of the exact handling logic along with where Reset interrupt happens will be revisited later.

Now, OpCodes will be implemented.

## Handling OpCodes

An opcode can be a maximum of 8 bits in length. Therefore, it is possible to have 255 different opcodes for the 6502. However, only a small number is used.

The `_handlOp` handler will just be a large switch statement that will read in the `op` number, and forward the operation by calling the subhandler. For example, if the opcode is `0xBD`, then it will be an LDA instruction.

When `_handleOp` receives `op` being `0xBD`, it will call the `_lda` function.

Within the `_lda` function, the context is read to determine the address mode, and value to load to accumulator.

This is the general approach to handling individual opcodes.

### Example 1: ADC

This is "add with carry". First, read the address for the value to add to the accumulator. 

* Operand 1 - Accumulator
* Operand 2 - Value stored in memory address
* Carry - Current status of the carry bit in  P register

Perform the following operation:

```
this.A = a + b + carry;
```

The status flags affected from this operations are:

1. Zero flag (Is the result 0?)
2. Negative flag (is th result negative?)
3. Carry flag (Is there a carry from the operation?)
4. Overflow flag (read: [Overflow Flag in Signed Arithmetic](./08-overflow-flag.md))

Then a simple implemenation will look like this:

```
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
```

### Example 2: AND

This is a bitwise-AND. It is an easy implementation, and to implement it, just bitwise-AND the accumulator, and the value found in the specific memory address.

The flags affected are:

1. Zero flag
2. Negative flag

```
private _and() {
    this.A &= this._memory.get(this._context.Address);
    this._setZero(this.A);
    this._setNegative(this.A);
}
```

### Example 3: BEQ

This is **branch on equal**. Meaning if the status bit of the zero flag is set, then branch to te offset from the current `PC`. 

Note that branching affects the number of cycles executed in the instruction. 

To add branch cycles, a helper method can be defined:

```
private _addBranchCycles(context: ICpuCycleContext) {
    this._cycles++;
    if (addressesCrossPageBoundary(context.PC, context.Address)) {
        this._cycles++;
    }
}
```

And then can be implement like so:

```
private _beq() {
    if (this._getStatusBitFlag(CpuStatusBitPositions.Zero)) {
        this.PC = this._context.Address;
        this._addBranchCycles(this._context);
    }
}
```

### Example 4: BRK

BRK forces an NMI and will increment the PC by 1.

The following occurs:

1. Push the current PC stack. First the low byte, followed by high byte.
2. Push the status register to the stack.
3. Set the IRQ disable flag int he status register

Then look up the IRQ Vector Location in memory and set the PC to the value in this address.

Then set the interrupt request to `None`.

On the next instruction, since the PC is at the interrupt vector location, the CPU will begin executing the interrupt handler.

```
```

### Example 5: CMP

Compares the accumulator with the value in memory.

Status flags affected:

1. Zero
2. Negative
3. Carry

```
private _cmp() {
    const value = this._memory.get(this._context.Address);
    this._compare(this.A, value);
}
```

### Example 6: JMP

Jump directly to address defiend in `PC`.

```
private _jmp() {
    this.PC = this._context.Address;
}
```

### Example 7: JSR

Jump to subroutine by the address found in PC.

The current address (return address) is built by taking the current address of the JSR instruction. 

Taking this address, we can push the bytes into the stack so we can return. First push the high byte first to the stack, and then following the lower byte.

Then set the `PC` to be the address indicated by JSR.

```
private _jsr() {
    const startAddr = this.PC - 1;
    this._stackPush((startAddr & 0xff00) >>> 8);
    this._stackPush(startAddr & 0x00ff);
    this.PC = this._context.Address;
}
```

Why `>>>`? It means to shift right, but replace the bits with 0 rather than 1.

### Example 8: LDA

Load byte value found in memory to the accumulator.

```
private _lda() {
    this.A = this._memory.get(this._context.Address);
    this._setNegative(this.A);
    this._setZero(this.A);
}
```

## Interrupt Handling

In this section, details about how to handle the 3 inerrupts are discussed.

### RESET

// Todo

### NMI

// Todo


### IRQ

// Todo

## Power Up State