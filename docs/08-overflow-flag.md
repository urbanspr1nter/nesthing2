# The Overflow Flag in Signed Arithmetic

The overflow flag for the 6502 is a tricky concept to understand. It took me a while to actually drill down to actually determine whether an `ADC`, or `SBC` operation would cause the `V` (overflow) bit to be set in the `P` status register.

It is all a deceivingly complicated process, and is a source of much confusion to first-time 6502 emulator authors. During the time I was performing research on the correct logic for implementing detection of an overflow, I found lots of forum posts just asking questions relating to this concept.

As you may all know, there are several other instructions aside from `ADC` and `SBC` which affect the overflow flag. I'm not going to discuss them here because they are trivial.

1. `CLV`
2. `BIT`
3. `PLP`
4. `RTI`

Instead, I'm going to invest all my efforts into explaining how `ADC` and `SBC` affects the `V` flag!

## What is an overflow?

Here's a good way to define what an **overflow** is for the 6502.

> If the result of a signed add or subtract won't fit into 8 bits, the overflow flag is set.

- http://www.righto.com/2012/12/the-6502-overflow-flag-explained.html

Remember the keyword **signed**. Overflow **applies to signed numbers**.

An _overflow_ is given when working with a CPU architecture with a specific bit-width, such as 8-bits, given an operation with 2 operands, we will obtain a result that can't be expressed by the number of bits allowed within a word for the architecture. (eg: 16 bit CPU => 16 bit words, 8 bit CPU => 8 bit words).

## Reading Binary as Unsigned and Signed Numbers

I feel it is incredibly important establish a fundamental understanding on how we read binary as either _unsigned_, or _signed_ first before diving into even attempting to understand signed arithmetic overflow.

If we're working with _unsigned_ numbers, the 6502 allows for 8 bits which can represent any number within the range of `[0, 255]`.

However, when taking into consideration signed numbers, things get a little complicated. This is when we have to care about `V`.

Interpreting 8 bits becomes interpreting the sign bit, and then the 7 other bits that follow. We'll use 0-based index notation for this. Bit 0 is the LSB, and Bit 7 is the MSB, which gives us a total of 8 bits to represent a byte in the context of the 6502.

If we're dealing with signed arithmetic in the 8 bit world, bit 7 becomes the sign-bit. Therefore this 8 bit number therefore becomes a signed number from the range of `[-128, 127]`.

How we read a negative number in binary is simply from how we _interpret_ whether or not our number should be read as signed, or unsigned. For example, should `1100 0010` be read as **194 unsigned**, or **-62 signed**? It all depends on the interpretation.

We can choose to either read a binary number as anywhere from `[0, 255]`, or say that instead, bit 7 should be the sign bit and interpret the binary number as `[-128, 127]`.

For example, suppose we have the binary number:

```
1011 1100
```

If we choose to interpret the above as an unsigned number then we can just say that the binary number `1011 1100` represents `188` in decimal.

What about the signed version? What does that represent? Since it is in the "on" position, then it becomes a negative and then we interpret this number as `-68`.

You might now be asking: _but how'd you come up with -68? If I just treat bit 7 as a "negative" flag, bit 0 to 6 doesn't give me 68! Isn't `1 011 1100` more like `-57`_?

Well, okay, it isn't so straightforward as I had made it out to be. Let's explain and talk about two's complement.

## Two's Complement

Given that we have established that a binary number is signed, such as `1011 1100`, we need to figure out what number it actually represents in decimal. We can just find the _two's complement_ of the above number to get our answer.

The process is as follows:

- Flip all the bits from `0` to `1` and `1` to `0`. This is called the _ones complement_. It's actually easy to do, in programming it's simply: `~a`
- Add 1 to this result.
  - `(~a) + 1`

The resulting number will be the number which the signed binary number represents.

Using our previous example:

```
1011 1100
```

1. We will interpret the number as a signed number.

2. Is bit-7 on? Yes. Then it will be a negative number.

3. Perform two's complement:

   ```
   Flip the bits:

   0100 0011

   Add 1:
         11
   0100 0011
   0000 0001
   ---------
   0100 0100
   ```

4. Take the two's complement and convert it to decimal:

   ```
   0100 0100

   2^6 + 2^2 = 64 + 4 = 68
   ```

5. Since this number is a negative number, our result is then `-68`.

## Signed Arithmetic

We're not done yet! We still need to learn how to actually perform calculations using _signed_ binary numbers!

Unsigned arithmetic is easy, we just need to add up our bits and carry as needed. Take a simple ADC pseudo-code instruction in the following example. Note that I have intentionally left the carry-in bit as 0 to simplify the explanation.

```
ADC 96, 13
```

The above is basically `96 +13`. Now since we're working with _unsigned_ at the moment, we just perform the operations in straight binary, bit-for-bit. In binary, we then have:

```
  0110 0000
+ 0000 1101
  ---------
  0110 1101
```

Converting the above answer of `0110 0101`, we get `109`. Just as expected.

That's all good.

Suppose now we have two operands `a` and `b` where `a` is 80 and `b` is 126. Performing the same style of pseudo code operation:

```
ADC 80, 126
```

Translating to binary, we will have:

```
  111
  0101 0000
+ 0111 1110
 ----------
  1100 1110
```

We will get `80 + 126 = 206`. This is good, and all **if we are performing unsigned arithmetic**.

But what happens if we were performing **signed arithmetic**? Right off the bat, we interpret those binary numbers as positive 80, and positive 126. That's great! So what does the operation give us, really? Immediately, bit 7 tells us our result is negative. Let's determine what the two's complement is:

```
1100 1110 (Our number will be negative)
         1
  0011 0001
+ 0000 0001
  ---------
  0011 0010 = 2^5 + 2^4 + 2^1 = 32 + 16 + 2 = 50

-50
```

Wait, so if we were to performed _signed arithmetic addition_ on `80 + 126`, I will get `-50`? That's not right, is it? A positive number added to a positive number _shouldn't_ give us a negative number! What is the most imporant observation here is that the sign of the result is **not what we are expecting**.

What we had just experienced was **overflow**. Basically, the result of our addition yielded a result that went beyond the range of how the computer _interprets_ an 8 bit signed number.

In the context of the 6502, we find that it then _signals_ to the programmer that the overflow occurred during the operation by setting the `V` bit to `1`.

## What about Subtraction with Signed Numbers?

Binary subtraction itself can be tricky. To do it at the bit-level requires understanding on two's complement and how converting a negative number to the two's complement allows for the same addition circuitry of the 6502 to operate as subtraction.

Subtraction of two operands `a`, and `b` is the same thing as addition of `a` and `b'` where `b' = twosComplement(b)`.

So here's our rule:

**Adding the two's complement of `b` is the same thing as subtracting `b` from `a`.**

Let's work through some examples in signed numbers.

```
SBC 100, 56
```

```
  0110 0100 - 0011 1000

  Take two's complement of 0011 1000
  ~(0011 1000) = 1100 0111

  Add 1 to the result
       111
  1100 0111
+ 0000 0001
  ---------
  1100 1000

 Rewrite:

 0110 0100 + 1100 1000

   0110 0100
 + 1100 1000
   ---------
 1 0010 1100

Discard the carry bit and the result is: 0010 1100, or 44.

100 - 56 = 44
```

That was not too bad. We were able to solve `100 - 56` through converting `56` to its two's complement version, and then adding that result to `100`. We then interpreted the result of `44` as a _signed_ number and still got the correct result after dropping the carry bit. All good!

What about the case where we end up with a result that is _less than -128_, or in this case interpreted as any number less than 0x80? This would be a **positive** number if we were to be working with signed numbers, and thus an overflow.

Let's work out some examples which cause subtraction to overflow. We'll first start with subtracting a negative number from a positive number.

```
3 - (-126) = 129

0000 0011 - -0111 1110
```

As previous mentioned, we can treat subtraction as addition if we take the two's complement of the subtrahend. In this case, the two's complement of `126` is `256 - 126 = 130`.

We then can form the expression where we can replace `-126` with `130`.

```
0000 0011 - 1000 0010
```

But wait, we will have subtraction! So, again we must take the two's complement of `130` which is `126`. Now, our subtraction expression is:

```
0000 0011 + 0111 1110
```

So, let's solve it.

```
  1111 11
  0000 0011
+ 0111 1110
  ---------
  1000 0001
```

Here, we run into trouble. Remember, we were doing _signed_ arithemetic. We had just gotten a negative number since bit 7 of `1000 0001` is set to `1`! If we were dealing with _unsigned_ numbers, then the result would have been correct as `1000 0001` represents 129. However, we have just gotten `signed(1000 0001) = -127` as our result.

This is exactly what _overflow_ in subtraction looks like. We were expecting a positive result, where in signed arithmetic, bit 7 of the result would have been `0`. Instead, our result needed all 8 bits in the byte to represent the proper number, leaving no room for the sign bit. This causes misinterpretation for the result to be negative.

Okay, now how about subtracting a positive number from a negative number?

```
-3 - 127 = -130
```

First, this is actually tricky. We need to find the two's complement for both `-3` and `127` to turn it into addition. Let's start with converting the subtrahend of `127` into addition of the two's complement.

```
- 3 + 129
```

Now, `-3`:

```
253 + 129
```

Let's convert that to binary:

```
         1
  1111 1101
+ 1000 0001
  ---------
  0111 1110
```

Huh! Again we have _overflowed_. The MSB is `0` indicating a positive result, but we had been expecting a _negative_ result where the MSB was supposed to be set to `1`!

## Summary

In summary, an overflow will happen under these scenarios for addition and subtraction:

### Overflow Scenarios

| Operation   | Operand A | Operand B | Final    |
| ----------- | --------- | --------- | -------- |
| Addition    | Positive  | Positive  | Negative |
| Addition    | Negative  | Negative  | Positive |
| Subtraction | Positive  | Negative  | Negative |
| Subtraction | Negative  | Positive  | Positive |

It's fairly easy to digest the table for addition. We just need to know that overflow can only occur if _both_ operands are of the same sign, either positive/positive or negative/negative and end up yielding a result of the _opposite_ sign.

- `positive + positive` should never give a `negative` result (when result is `0x80` to `0xFF`.
- `negative + negative` should never give a `positive` result. (when the result is `0x00` to `0x7F`)

If either of those cases happen, then we definitely have an overflow for addition.

As mentioned before, subtraction is a little bit tricker, but think of it as the opposite.

- The initial condition is that the operands must be of opposite signs. The _first_ operand then must be the opposite sign of the result.
- `positive - negative` should never give a `negative` result
- `negative - positive` should never give a `positive` result.

## Implementation

You may now be itching to write some code. Let's do that. In this exercise we'll implement a routine to check if 2 operands `a`, and `b` along with a `result` yielded an overflow. We will implement it first for `ADC` and then for `SBC`.

The implementation language of choice is TypeScript 3, but if you know any JavaScript, or "C-style" syntax, then it should be fairly easy to understand, and port.

We'll also write some unit tests using the `jest` framework to check our work.

### ADC Logic

We know that `ADC` overflow occurs under the following conditions:

- positive + positive = negative
- negative + negative = positive

We can simplify to say that both operands in addition must be the same sign, and the result must be a different sign.

Since the sign bit in signed arithmetic is just bit 7, we can use `0x80` as the bit mask to test to see if the either operands, or result has its MSB set, or not.

We can test for the operands to be the same sign with the following boolean conditional:

```js
const positiveOperands = (first & 0x80) === 0 && (second & 0x80) === 0;

const negativeOperands = (first & 0x80) !== 0 && (second & 0x80) !== 0;
```

Now, we need to check the if the sign of the result is different from the operands.

```js
const negativeResult = (result & 0x80) !== 0;

const positiveResult = (result & 0x80) === 0;
```

Finally, we can then combine these checks:

```js
function isOverflowOnAdc(first: number, second: number, result: number) {
  if (
    (positiveOperands && negativeResult) ||
    (negativeOperands && positiveResult)
  ) {
    return true;
  }
  return false;
}
```

We can do better! Notice that we only need to be considered whether, or not the `first` or `second` number have the same signs. We can achieve this by taking computing `first ^ second`, which will then either set the bit 7 of this computed result to `0` if the signs are the same, `1/1`, or `0/0`, and `1` if the signs are different `1/0`, or `0/1`. 

```js
const isSameOperandSign = ((first ^ second) & 0x80) === 0;
```

The result is also the same, we can just check to see if either operand and the result signs are different by performing an  `xor` again. We choose `first` to be tested with `result` in this case:

```js
const isDifferentResultSign = ((first ^ result) & 0x80) !== 0
```

We can rewrite the function to be:

```js
function isOverflowOnAdc(first: number, second: number, result: number) {
  const isSameOperandSign = ((first ^ second) & 0x80) === 0;
  const isDifferentResultSign = ((first ^ result) & 0x80) !== 0

  return isSameOperandSign && isDifferentResultSign;
}
```

Or:

```js
function isOverflowOnAdc(first: number, second: number, result: number) {
  return ((first ^ second) & 0x80) === 0 && ((first ^ result) & 0x80) !== 0;
}
```

## SBC Logic

We know that `SBC` overflow occurs under the following conditions:

* positive - negative = negative
* negative - positive = positive

Looking at this, the operands must be a different sign from each other:

```js
const isOperandDifferentSign = 
  ((first & 0x80) === 0 && (second & 0x80) !== 0) || 
  ((first & 0x80) !== 0 && (second & 0x80) === 0);
```

We simplifying this, we can perform the `xor` on both operands and mask only the bit position of the sign bit to determine whether or not both operands have a different sign:

```js
const isOperandDifferentSign = ((first ^ second) & 0x80) !== 0;
```

How about the result? Well looks like the only requirement here is that the result's sign must be different from the `first` operand sign!

```js
const isResultSignDifferentFromFirst = ((first ^ result) & 0x80) !== 0;
```

Now, combining it into a function:

```js
function isOverflowOnSbc(first: number, second: number, result: number) {
  const isOperandDifferentSign = ((first ^ second) & 0x80) !== 0;
  const isResultSignDifferentFromFirst = ((first ^ result) & 0x80) !== 0;

  return isOperandDifferentSign && isResultSignDifferentFromFirst;
}
```
Simplifying it all:

```js
function isOverflowOnSbc(first: number, second: number, result: number) {
  return ((first ^ second) & 0x80) !== 0 && ((first ^ result) & 0x80) !== 0;
}
```

## Tests

Okay now we have written these two functions to determine overflow on `ADC`, and `SBC`:

```js
function isOverflowOnAdc(first: number, second: number, result: number) {
  return ((first ^ second) & 0x80) === 0 && ((first ^ result) & 0x80) !== 0;
}

function isOverflowOnSbc(first: number, second: number, result: number) {
  return ((first ^ second) & 0x80) !== 0 && ((first ^ result) & 0x80) !== 0;
}
```

It'd be nice to cover every single case. For addition, we would want to first start out with a carry in of 0. 

#### ADC positive + positive = negative

We know that positive numbers range from `0x00` to `0x7F`. This is `[0, 127]`. In order to force an overflow, we must then take any number within this range and add it against another number that will exceed `0x7F`. Otherwise we shouldn't expect an overflow.

Suppose we have `a` and `b`. 

* If `a` is `1` then that means `b` must be from `0x7F`. 
* If `a` is `2` then `b` can range from `0x7E` to `0x7F`. 
* If `a` is `3` then `b` can range from `[0x7C, 0x7F]`. 

All of these will trigger overflow, anything else won't. We can then generalize it as:

```js
function testAdcPositiveOperandOverflow() {
  const carry = 0;
  for(let a = 0; a <= 0x7F; a++) {
    for(let b = 0; b <= 0x7F; b++) {
      const result = (a + b + carry) & 0xff;
      if(result <= 0x7F) {
        expect(isOverflowOnAdc(a, b, result)).toBe(false);
      } else {
        expect(isOverflowOnAdc(a, b, result)).toBe(true);
      }
    }
  }
}
```

#### ADC negative + negative = positive

Same thing for the above, instead, we want to start in the range of `0x80` to `0xFF` (`[-128, -1]`).

```js
function testAdcNegativeOperandOverflow() {
  const carry = 0;
  for(let a = 0; a <= 0xff; a++) {
    for(let b = 0; b <= 0xff; b++) {
      const result = (a + b + carry) & 0xff;
      if(result <= 0x7F) {
        expect(isOverflowOnAdc(a, b, result)).toBe(true);
      } else {
        expect(isOverflowOnAdc(a, b, result)).toBe(false);
      }
    }
  }
}
```

#### General Test for Testing ADC Overflow

Let's generalize all this in addition with accounting for the carry bit. The following test will test for all combinations of numbers from 0 to 255 on ADC. 

```js
function testAdcOverflow() {
  for(let carry = 0; carry <= 1; carry++) {
    for(let a = 0; a <= 0xff; a++) {
      for(let b = 0; b <= 0xff; b++) {
        const result = (a + b + carry) & 0xff;
        if(a <= 0x7F && b <= 0x7F && result >= 0x80) {
          expect(isOverflowOnAdc(a, b, result)).toBe(true);
        } else if(a >= 0x80 && b >= 0x80 && result <= 0x7F) {
          expect(isOverflowOnAdc(a, b, result)).toBe(true);
        } else {
          expect(isOverflowOnAdc(a, b, result)).toBe(false);
        }
      }
    }
  }
}
```

#### SBC Tests

Once we know the general approach for ADC, SBC is actually pretty simple:

```js
function testAdcOverflow() {
  for(let carry = 0; carry <= 1; carry++) {
    for(let a = 0; a <= 0xff; a++) {
      for(let b = 0; b <= 0xff; b++) {
        const result = (a - b - ( 1 - carry)) & 0xff;
        if(a <= 0x7F && b >= 0x80 && result >= 0x80) {
          expect(isOverflowOnSbc(a, b, result)).toBe(true);
        } else if(a >= 0x80 && b <= 0x7F && result <= 0x7F) {
          expect(isOverflowOnSbc(a, b, result)).toBe(true);
        } else {
          expect(isOverflowOnSbc(a, b, result)).toBe(false);
        }
      }
    }
  }
}
```

## References

- http://www.righto.com/2012/12/the-6502-overflow-flag-explained.html
- http://www.6502.org/tutorials/vflag.html