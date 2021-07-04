# Introduction

This is one of those Saturdays where I am working on a "work project", and unfortunately don't have enough time to actually work on my hobby projects. :( The side-effect of all this is that I often have to wait for my work code to build and find myself just quickly checking up the news for interesting articles for which I will often  bookmark to "read later".

Instead of doing that today, allow me to actually give a sort-of "executive summary" in why I'm working on this emulator project.

## History

Even though it is 2019 now, I actually started this project in mid-2017 while my wife (then girlfriend) was recovering from a major surgery. Having time while I was taking care of her, along with with my intense interest in retro-gaming, I decided to take a stab at writing a video game console emulator.

The glaring challenge was that I had no clue how to write a video game console emulator! The only real experience I had that was "close" to writing an emulator was through a few projects I had done in my Computer Architecture class back in University. Even then, it was just building a simple CPU. It was not based on anything that was actually released commercially.

Since I started, I have been working on and off this project. First, learning the system architecture of the NES, then getting familiarity with its 6502 CPU. Then what sort of happened was that I fell into a loop of minor successes, and major failures. The best way to describe it was taking "1 step forward" and "0.999997 steps back". So you can kind of figure that the development has been very, very, very slow. Would we consider this vaporware? No, I haven't promised anything... so that's good, right?

Anyway, the failure loop was something like this:

* Get stuck implementing the CPU.
* Figuring out how to implement said part of the CPU I was stuck on.
* Then having no idea how to implement the PPU.
* Attempt to implement the PPU, and fail.
* Sort of get the PPU working.
* Get confused again due to some bug.
* Repeat.

You get the idea. Unfortunately, it has taken me this long to get to where you see this repository is at right now. :)

What you're actually seeing here is not the original codebase. I have been through 2 other codebases before this one. These implementations were in:

1. Java
2. C
3. TypeScript/JavaScript (**Present**)

I've had many challenges along the way, but I have made progress... just, very slowly. Because of the pace of the progress, I have found it might be handy to keep a journal of my journey through documentation.

Everything I have learned about the NES and emulator development goes in here. It's all a work-in-progress, but check back often and you might see new content here and there.

## Who???

I am just your regular guy trying to make an emulator. I'm a Software Engineer at Big-Co by day, but Software Engineer at Me-Co by night. :D

You can visit my personal website here: https://rogerngo.com.

## What???

This project is basically an emulator written in JavaScript. The graphics rendering is in HTML5 canvas with all the UI code glued together with React. It's fairly simple and easy to understand, and I have purposely made it that way. Huge gaps in time with respect to actually working on the project has taught me to just keep the code as simple as possible. It makes it easier to go back and figure out where I last left off at.

## When???

I started this project in 2017, but will probably not finish it until I'm 40 years old. Hahaha... take a guess how old I am now...

Okay, in all seriousness, I don't expect to be done at all. I don't even know the scope! Maybe I'll just get simple games like Donkey Kong or Mario Bros. running. Maybe I'll get something like Battletoads emulated. I'm not sure here. We'll see.

## Where???

In  a 700 sq ft. apartment situated in a mostly cloudy, but sometimes sunny Silicon Valley, California, of course!

## Why???

Short answer? It's fun!

Long answer? Well...

In my opinion, writing an emulator is one of the most difficult projects a software developer can undertake.

There are other certain things that make writing emulators hard:

* Learning the system architecture of the platform to be emulated.
* Reverse engineering the behavior of each component through inspecting how code is executed, or reading tons of documentation available for the platform.
* Convincing oneself to think at the cycle-for-cyle level when it comes to executing code and writing to memory. Most software developers can get away without thinking this low-level, but it is impossible not to for projects such as computer and video game emulators.

All in all, expect a lot of difficult challenges along the way when getting started in writing an emulator.

Usually, the best advice given when Google searching: "How to write an emulator" is to start writing an emulator for some 8-bit microcomputer. CHIP-8 is a common one that comes up. If you browse reddit.com/r/emudev, you'll see a lot of CHIP-8 projects floating around.

I personally don't find much appeal in writing a CHIP-8 emulator. 

In fact, I feel like a great place to start is on a simple system one can relate with. For me, it is the NES (Nintendo Entertainment System). Yes, I'm American, so that is how I will be referring to the system -- Maybe down the line I will interchange it with "Famicom", but we'll see.

## How???

Some Visual Studio Code here, some JavaScript there, some NesDev forum questions EVERYWHERE!

## 2021 Update

It's 2021 now, and I am finally revisiting this project. The world has been different the past couple of years, and I am now a dad! Not sure why I decided to look at this project again, but I think there is some temptation in me to rewrite the emulator to be more performant. Since 2019, I have
learned a lot about web and JavaScript performance and internals. I want to be able to put to use, the knowledge that I have gained into something that I struggled with in the past.

What I have struggled with in the past is getting this emulator to run FAST. Now, I will attempt it.

### References

* Nintendo Entertainment System Documentation - Version 1.0
    * Patrick Diskin
* Nestech.txt - (https://wiki.nesdev.com/w/index.php/Nestech.txt)
    * Jeremy Chadwick