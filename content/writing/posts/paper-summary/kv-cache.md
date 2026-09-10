---
title: KV Cache
group: paper-summary
date: 2026-09-08
---
## Overview

KV cache is an inference optimization used in autoregressive Transformer models.

During generation, the model produces one new token at a time. At decoding step \(t\), the model only needs the hidden state of the last token to predict the next token.

Without KV cache, however, the Transformer repeatedly processes the entire sequence from the beginning. This means that representations for previous tokens are recomputed at every decoding step.

KV cache avoids this redundant computation by storing the previously computed Key and Value tensors and reusing them in later decoding steps.

---

## Main Idea of KV Cache

Suppose the model is generating the sequence:

$$
\text{I} \rightarrow \text{I love} \rightarrow \text{I love you} \rightarrow \cdots
$$

Without KV cache, the input to the Transformer grows at every decoding step:

$$
\begin{aligned}
t=1 &: (N,1,D) \\
t=2 &: (N,2,D) \\
t=3 &: (N,3,D) \\
&\vdots \\
t=T &: (N,T,D)
\end{aligned}
$$

Accordingly, the Transformer also produces outputs for every token:

$$
(N,t,D)
$$

However, during autoregressive generation, only the last output is needed to predict the next token:

$$
(N,t,D)
\quad \longrightarrow \quad
\boxed{(N,1,D)}
$$

The other \(t-1\) outputs were already computed in previous decoding steps.

This means that without KV cache, the model repeatedly recomputes representations for old tokens even though only the newest token's output is actually needed.

![Without KV cache](sandbox:/mnt/data/Screenshot%202026-09-11%20at%201.12.37%E2%80%AFAM.png)

The same redundancy occurs when computing the Key and Value tensors. At every step, \(K\) and \(V\) for all previous tokens are calculated again.

KV cache solves this by storing the previously calculated \(K\) and \(V\).

At step \(t\), instead of processing

$$
X_{1:t} \in \mathbb{R}^{N\times t\times D},
$$

the Transformer only processes the newly generated token:

$$
x_t \in \mathbb{R}^{N\times1\times D}.
$$

It computes only

$$
q_t,\;k_t,\;v_t
$$

for that token.

The new \(k_t\) and \(v_t\) are then appended to the cached values:

$$
K_{1:t}
=
\operatorname{Concat}(K_{1:t-1},k_t)
$$

$$
V_{1:t}
=
\operatorname{Concat}(V_{1:t-1},v_t)
$$

Therefore, attention can use all previous Keys and Values without recomputing them.

![With KV cache](sandbox:/mnt/data/Screenshot%202026-09-11%20at%201.12.45%E2%80%AFAM.png)

The important distinction is:

$$
\boxed{
\text{Without KV cache: }(N,t,D)\rightarrow(N,t,D)
}
$$

while with KV cache:

$$
\boxed{
\text{With KV cache: }(N,1,D)\rightarrow(N,1,D)
}
$$

The history is still available to attention through the cached

$$
K_{1:t},V_{1:t}.
$$

---

## How Time Complexity Changes

The following analysis considers one decoding step at time \(t\), treating \(N,D,d_k,d_v\) as constants and focusing on how the cost grows with sequence length \(t\).

### Without KV Cache

At time \(t\), the entire sequence \(X_{1:t}\) is processed again.

| Step                              | Shape / Operation      |              Time Complexity |
| --------------------------------- | ---------------------- | ---------------------------: |
| \(Q_{1:t}=X_{1:t}W_Q\)            | \((N,t,D)(D,d_k)\)     |    \(O(NtDd_k)\approx O(t)\) |
| \(K_{1:t}=X_{1:t}W_K\)            | \((N,t,D)(D,d_k)\)     |    \(O(NtDd_k)\approx O(t)\) |
| \(V_{1:t}=X_{1:t}W_V\)            | \((N,t,D)(D,d_v)\)     |    \(O(NtDd_v)\approx O(t)\) |
| \(Q_{1:t}K_{1:t}^{T}\)            | \((N,t,d_k)(N,d_k,t)\) | \(O(Nt^2d_k)\approx O(t^2)\) |
| Softmax                           | \((N,t,t)\)            |    \(O(Nt^2)\approx O(t^2)\) |
| \(\operatorname{Softmax}(QK^T)V\) | \((N,t,t)(N,t,d_v)\)   | \(O(Nt^2d_v)\approx O(t^2)\) |
| Output projection                 | \((N,t,d_v)W_O\)       |    \(O(Ntd_vD)\approx O(t)\) |

The dominant attention operations are therefore:

$$
\boxed{O(t^2)}
$$

for a single decoding step.

### With KV Cache

With KV cache, only the newest token is projected into \(q_t,k_t,v_t\).

| Step                                      | Shape / Operation                        |          Time Complexity |
| ----------------------------------------- | ---------------------------------------- | -----------------------: |
| \(q_t=x_tW_Q\)                            | \((N,1,D)(D,d_k)\rightarrow(N,1,d_k)\)   | \(O(NDd_k)\approx O(1)\) |
| \(k_t=x_tW_K\)                            | \((N,1,D)(D,d_k)\rightarrow(N,1,d_k)\)   | \(O(NDd_k)\approx O(1)\) |
| \(v_t=x_tW_V\)                            | \((N,1,D)(D,d_v)\rightarrow(N,1,d_v)\)   | \(O(NDd_v)\approx O(1)\) |
| \(q_tK_{1:t}^{T}\)                        | \((N,1,d_k)(N,d_k,t)\rightarrow(N,1,t)\) | \(O(Ntd_k)\approx O(t)\) |
| Softmax                                   | \((N,1,t)\)                              |    \(O(Nt)\approx O(t)\) |
| \(\operatorname{Softmax}(q_tK^T)V_{1:t}\) | \((N,1,t)(N,t,d_v)\rightarrow(N,1,d_v)\) | \(O(Ntd_v)\approx O(t)\) |
| Output projection                         | \((N,1,d_v)W_O\)                         | \(O(Nd_vD)\approx O(1)\) |

Therefore, the dominant attention computation at one decoding step becomes:

$$
\boxed{O(t)}
$$

instead of

$$
\boxed{O(t^2)}.
$$

---

## Time Complexity for Generating All \(T\) Tokens

Without KV cache, attention at decoding step \(t\) costs approximately:

$$
O(t^2).
$$

Therefore:

$$
\begin{aligned}
t=1 &: O(1) \\
t=2 &: O(4) \\
t=3 &: O(9) \\
&\vdots \\
t=T &: O(T^2)
\end{aligned}
$$

The total attention computation for generating \(T\) tokens is:

$$
O(1^2)+O(2^2)+O(3^2)+\cdots+O(T^2).
$$

Since

$$
\sum_{t=1}^{T}t^2
=
\frac{T(T+1)(2T+1)}{6},
$$

the total complexity is:

$$
\boxed{O(T^3)}
$$

### With KV Cache

With KV cache, attention at step \(t\) costs:

$$
O(t).
$$

Therefore:

$$
\begin{aligned}
t=1 &: O(1) \\
t=2 &: O(2) \\
t=3 &: O(3) \\
&\vdots \\
t=T &: O(T)
\end{aligned}
$$

The total attention computation becomes:

$$
O(1)+O(2)+O(3)+\cdots+O(T).
$$

Since

$$
\sum_{t=1}^{T}t
=
\frac{T(T+1)}{2},
$$

the total complexity is:

$$
\boxed{O(T^2)}
$$

So, with respect to sequence length:

$$
\boxed{
O(T^3)
\quad\longrightarrow\quad
O(T^2)
}
$$

for autoregressive attention over the entire generation.

---

## Simple Summary

### Without KV Cache

At time \(t\), the model receives:

$$
X_{1:t}:(N,t,D).
$$

It calculates:

$$
Q_{1:t},K_{1:t}\in\mathbb{R}^{N\times t\times d_k}
$$

and

$$
V_{1:t}\in\mathbb{R}^{N\times t\times d_v}.
$$

Attention is calculated using:

$$
Q_{1:t}
\quad\text{against}\quad
K_{1:t},V_{1:t}.
$$

The MHA output has shape:

$$
\boxed{(N,t,D)}
$$

even though only its last position is needed for generating the next token.

### With KV Cache

At time \(t\), the model receives only the newest token:

$$
x_t:(N,1,D).
$$

It calculates only:

$$
q_t,k_t:(N,1,d_k)
$$

and

$$
v_t:(N,1,d_v).
$$

The new \(k_t\) and \(v_t\) are appended to the previous KV cache:

$$
K_{1:t}:(N,t,d_k)
$$

$$
V_{1:t}:(N,t,d_v).
$$

Attention is then calculated using:

$$
q_t
\quad\text{against}\quad
K_{1:t},V_{1:t}.
$$

The MHA output has shape:

$$
\boxed{(N,1,D)}.
$$

In short:

$$
\boxed{
\begin{aligned}
\text{Without KV cache: }&
Q_{1:t},K_{1:t},V_{1:t}
\rightarrow (N,t,D)
\\[4pt]
\text{With KV cache: }&
q_t,K_{1:t},V_{1:t}
\rightarrow (N,1,D)
\end{aligned}
}
$$
