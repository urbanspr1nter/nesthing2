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

## Power Up State