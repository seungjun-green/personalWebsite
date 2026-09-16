---
title: Flash Attention
group: paper-summary
date: 2026-09-16
---
## Overview

HBM is large but slow, and SRAM is small but fast and good for matrix multiplication. So from standard attention, we have been using tiling to calculate attention, like moving a $Q$ tile and a $K$ tile to SRAM, calculating the attention answer, and sending it back to HBM.

Here comes the main bottleneck. Keep moving tensors from HBM to SRAM takes a lot of time, and flash attention managed to reduce the read/write operations substantially, making attention calculation faster.

## Standard Attention

The way attention gets calculated is basically three steps: first we get the scores $S = QK^\top$, then we do $P = \text{softmax}(S)$ row by row, and finally the output $O = PV$.

The thing is, in standard attention they had to move the entire $Q$ and $K$ to SRAM from HBM, and also send $QK^\top$ back to HBM from SRAM; and then send the entire $QK^\top$ to SRAM from HBM again, and send $\text{softmax}(QK^\top)$ back to HBM from SRAM; and also send the entire $\text{softmax}(QK^\top)$ and $V$ to SRAM from HBM, and also send back $\text{softmax}(QK^\top)\,V$ from SRAM to HBM. It's not moving it all at once of course, but tiling, tiling, tiling, and eventually it becomes like this. (Here, $Q$ and $K$ are sent to SRAM from HBM using tiling, and when doing softmax, $QK^\top$ is sent to SRAM row by row, and $V$ is also sent to SRAM by tiling.)

![screenshot-2026-09-16-at-5-09-15-pm](/writing/paper-summary/flash-attention/1789546156817-0-screenshot-2026-09-16-at-5-09-15-pm.png)

## Flash Attention

Flash attention gets the same answer, but the trick is it doesn't keep sending those big intermediate matrices back to HBM. It sends the entire $Q$ and $K$ to SRAM from HBM, does the work on-chip, and only sends the final $\text{softmax}(QK^\top)\,V$ back, so the entire $\text{softmax}(QK^\top)$ and $V$ stay in SRAM while it computes, instead of going back and forth. Again, it's not all at once, but tiling, tiling, tiling, and eventually it becomes like this.

This became possible thanks to online softmax, since it lets us do the softmax bit by bit as each tile comes in, so we never need the whole $QK^\top$ row sitting there at once. (Here, all three, $Q$, $K$, $V$, are sent to SRAM from HBM using tiling.)

![screenshot-2026-09-16-at-5-09-45-pm](/writing/paper-summary/flash-attention/1789546187495-0-screenshot-2026-09-16-at-5-09-45-pm.png)

### Online Softmax

![image](/writing/paper-summary/flash-attention/1789545903288-0-image.png)

## How the Read/Write Complexity Actually Got Improved


### Normal Attention

Input is $(N, L, D)$, so $Q, K, V$ are each $(N, L, D)$, and $QK^\top$ and $\text{softmax}(QK^\top)$ are $(N, L, L)$.

| Step | Read/Write complexity | Comment |
|---|---|---|
| move $Q$ (HBM → SRAM) | $N L D$ | |
| move $K$ (HBM → SRAM) | $N L D$ | and do matrix multiplication |
| move $QK^\top$ (SRAM → HBM) | $N L^2$ | |
| move $QK^\top$ (HBM → SRAM) | $N L^2$ | and calculate softmax |
| move $\text{softmax}(QK^\top)$ (SRAM → HBM) | $N L^2$ | |
| move $\text{softmax}(QK^\top)$ (HBM → SRAM) | $N L^2$ | |
| move $V$ (HBM → SRAM) | $N L D$ | and do matrix multiplication |
| move $\text{softmax}(QK^\top)\,V$ (SRAM → HBM) | $N L D$ | |

Total: $O(N L^2 + N L D)$, where the $N L^2$ terms from writing/reading the big $(N, L, L)$ matrices dominate.

### Flash Attention

| Step | Read/Write complexity | Comment |
|---|---|---|
| move $Q$ (HBM → SRAM) | $N L D$ | |
| move $K$ (HBM → SRAM) | $N L D$ | do $QK^\top$ on-chip, and online softmax |
| move $V$ (HBM → SRAM) | $N L D$ | multiply with $V$ |
| move $\text{softmax}(QK^\top)\,V$ (SRAM → HBM) | $N L D$ | |

Total: $O(N L D)$, since the $(N, L, L)$ matrices never touch HBM, so the $N L^2$ terms are gone.
