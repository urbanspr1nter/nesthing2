# Memory Mapping

## Conceptual Introduction

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

