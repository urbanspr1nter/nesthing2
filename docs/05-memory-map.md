# Memory Mapping

## Conceptual Introduction

Here is a good Wikipedia article that discusses the concept of Memory-mapped I/O: https://en.wikipedia.org/wiki/Memory-mapped_I/O.

The gist of the concept is that the same **address space** of a computer is used to access both memory, and I/O devices. The ports of the I/O are abstracted as "addresses" within the memory address space.

The benefit is that the CPU instructions will then just access memory and I/O both as if they were just in memory. For CPU to send data back and forth between an I/O device just means to write data to a specific address mapped to that I/O device!

The advantages/disadvantages of using Memory-mapped I/O in CPU design is discussed in the article.(Less hardware needed to build CPU to handle I/O, leading to less power consumption, smaller chips, etc...)

## How NES CPU Does It

The NES has the following memory map:

|Memory Address|Purpose|
|--------------|-------|
|0x0000 - 0x00FF| Zero Page|
|0x0100 - 0x01FF| Stack|
|0x0200 - 0x07FF| RAM|
|0x0800 - 0x1FFF| Mirrors of 0x0000 - 0x07FF (3 times)|
|0x2000 - 0x2007| I/O Registers|
|0x2008 - 0x3FFF| Mirrors of I/O Registers|
|0x4000 - 0x401F| I/O Registers|
|0x4020 - 0x5FFF| Expansion ROM|
|0x6000 - 0x7FFF| SRAM|
|0x8000 - 0xBFFF| PRG ROM (Lower bank)|
|0xC000 - 0xFFFF| PRG ROM (Upper bank)|

### Mirroring

For every read or write to let's say 0x0001, then the same piece of data will be written to 0x0801, 0x1001, and 0x1801.

In the `memory.ts` implementation, there will need some logic to map the writes and reads to the primary mirror. So for example a write at `0x1FFF` should redirect to `0x07FF`.

A way to do this is through a conditional statement to check for the address. 

For example, if the memory address is lower than `0x2000`, then it is known that RAM must be divided into segments of `0x800` bytes in size. Therefore, a modulo operator can be applied:

```
if (cleanedAddress < 2000) {
    this._memory[cleanedAddress % 0x800] = cleanedValue;
} else {
    this._memory[cleanedAddress] = cleanedValue;
}
```

The above will then write to the mirrors in RAM address space just fine.

## PPU Memory Map

To be discussed at another time, but the addresses in 0x2000 to 0x3FFF are I/O reserved for the 2A03. The PPU is the I/O device in the NES which will make use of these ranges.

The PPU will reserve 8 addresses to be used as its own set of registers and the rest will be reserved for graphics memory (VRAM, palette RAM, and so on...)
