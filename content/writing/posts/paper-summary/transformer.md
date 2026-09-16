---
title: Transformer
group: paper-summary
date: 2026-09-16
---
Here we’ll conver in order of Embedding Layer, Positional Encoding, MHA(MutoHead Attention), Add & Norm (layerNorm), Linear, FFN. Plus here N, L, D means batch size, sequence length, and model dimension respectively.

## Embedding Layer

- (N, L) -> (N, L, D)

- The embedding layer functions as a learnable look-up table that maps discrete token indices into a continuous vector space. It transforms the input tensor of shape (N, L) containing integer IDs, into a dense representation of shape (N, L, D). Each unique token in the vocabulary is assigned a fixed-size vector of dimension $D$, which allows the model to represent semantic relationships numerically before processing begins.

## Postional Encoding

Since the Transformer architecture does not use recurrence or convolution, it has no inherent way to account for the order of tokens in a sequence. Positional Encoding solves this by adding a unique vector to each input embedding, providing the model with information about where each word is located. These encodings use sine and cosine functions of varying frequencies to create a distinct signature for every position. This specific mathematical design allows the model to not only recognize the absolute position of a token but also to easily compute the relative distance between different words, ensuring the sequence structure is preserved during the self-attention process.

$$
PE_{(pos,2i)}
=
\sin\left(
\frac{pos}{10000^{2i/d_{model}}}
\right)
$$

$$
PE_{(pos,2i+1)}
=
\cos\left(
\frac{pos}{10000^{2i/d_{model}}}
\right)
$$

Here’s an exmaple of result of pos encoding. Where a sentence is 4 tokens — “I am a robot” and dimension is 8.

| Token | pos | i=0, Dim 0 | i=0, Dim 1 | i=1, Dim 2 | i=1, Dim 3 | i=2, Dim 4 | i=2, Dim 5 | i=3, Dim 6 | i=3, Dim 7 |
|---|---:|---|---|---|---|---|---|---|---|
| I | 0 | sin(0/1) | cos(0/1) | sin(0/10) | cos(0/10) | sin(0/100) | cos(0/100) | sin(0/1000) | cos(0/1000) |
| am | 1 | sin(1/1) | cos(1/1) | sin(1/10) | cos(1/10) | sin(1/100) | cos(1/100) | sin(1/1000) | cos(1/1000) |
| a | 2 | sin(2/1) | cos(2/1) | sin(2/10) | cos(2/10) | sin(2/100) | cos(2/100) | sin(2/1000) | cos(2/1000) |
| robot | 3 | sin(3/1) | cos(3/1) | sin(3/10) | cos(3/10) | sin(3/100) | cos(3/100) | sin(3/1000) | cos(3/1000) |

## MHA

Multi-Head Attention literally means that there are multiple attention heads operating in parallel.

### 1. Generating Q, K, and V

First, all heads receive the same input from the previous step with a shape of (N, L, D). For each individual head, we create the Query (Q), Key (K), and Value (V) tensors using learnable weight matrices:

- Input (N, L, D) @ W_Q (D, d_k) => Q (N, L, d_k)

- Input (N, L, D) @ W_K (D, d_k) => K (N, L, d_k)

- Input (N, L, D) @ W_V (D, d_v) => V (N, L, d_v)

In this setup, d_k = d_v = D / number of heads. By projecting the model dimension D into these smaller dimensions, each head can focus on different parts of the sequence.

### 2. The Attention Calculation

Once Q, K, and V are created, we apply the standard attention equation:

$$
\operatorname{Attention}(Q, K, V)
=
\operatorname{softmax}
\left(
\frac{QK^T}{\sqrt{d_k}}
\right)V
$$

- $QK^T$ yields a shape of $(N, L, L)$.

- $\operatorname{Softmax}(QK^T / \sqrt{d_k})V$ yields a final head output of $(N, L, d_v)$.

Note on Look-ahead MHA: If we are using a masked decoder, we add a mask here with a shape of $(N, L, L)$. Each $(L, L)$ matrix within the batch contains the same values: a lower-triangular matrix where the diagonal and everything below it are 0, and the rest (the future tokens) are $-\infty$.

$$
\begin{bmatrix}
0 & -\infty & -\infty & -\infty & -\infty \\
0 & 0 & -\infty & -\infty & -\infty \\
0 & 0 & 0 & -\infty & -\infty \\
0 & 0 & 0 & 0 & -\infty \\
0 & 0 & 0 & 0 & 0
\end{bmatrix}
$$

### 3. Concatenation and Output

After all heads have finished their calculations, we call each head’s final output head_1 and combine them:

$$
\operatorname{Concat}(\text{head}_1, \text{head}_2, \ldots, \text{head}_h) W_O
$$

We concatenate along the last dimension, so the combined tensor becomes $(N, L, h * d_v)$. Since the output weight matrix $W_O$ has a shape of $(D, D)$, the final output shape becomes:

$$
(N, L, h * d_v) @ (D, D) \Rightarrow (N, L, D)
$$

### A Note on Implementation

To keep things simple, I have used 3D dimensions here. In practice, these operations are often performed in 4D (Batch, Heads, Seq_Length, Head_Dim). By structuring the data this way, the GPU can process all attention heads simultaneously, making the whole operation significantly faster.

## Add & Norm (layerNorm)

(N, L, D) normalized across the last dimension, so we’re normalizing (N, L, D) N * L times using following equations.

$$
\operatorname{LayerNorm}(x)
=
\gamma
\left(
\frac{x-\mu}{\sigma}
\right)
+
\beta
$$

**Why do the normalization?** Training Stability and Fast Convergence

Say the tensor shape is: (N, L, D)

LayerNorm happens independently for each token across the hidden dimension HH. So for: `x[n,l,:]`

We use normalization mainly to keep activations at a stable scale while they pass through many Transformer layers.

Without normalization, hidden values can gradually become too large or too small:

$$
x
\rightarrow
\text{Attention}
\rightarrow
\text{Residual}
\rightarrow
\text{MLP}
\rightarrow
\text{Residual}
\rightarrow
\cdots
$$

After dozens of layers, the magnitude can drift a lot. That can make optimization unstable and gradients harder to control.

Normalization keeps each token representation in a more predictable numerical range:

$$
[20, -8, 15, -30, \ldots]
$$

might become something like:

$$
[0.9, -0.4, 0.7, -1.5, \ldots]
$$

The important part is that the relative pattern is still there, but the overall scale is controlled.

So the main reasons are:

- more stable activations
- more stable gradients
- easier optimization
- allows very deep Transformers to train reliably

It is basically a way of saying:

> “Keep the information in this vector, but don’t let its numerical scale get out of control.”


**Why use gamma and beta?** When we normalize a vector, we force its mean to be 0 and its variance to be 1. While this is great for stability, it is **too restrictive**. It might actually remove information that the network needs to represent complex patterns.

## FFN

- $(N, L, D) \rightarrow (N, L, 2D) \rightarrow (N, L, D)$

## Linear

- $(N, L, D) \rightarrow (N, L, V)$

- change dimension from $D$ (model dimension) to $V$ (vocab size)

## Softmax

- $(N, L, D)$; softmax is applied to the last dimension, total applied $N \times L$ times.


### What’s softmax?

Softmax converts a vector of raw scores, or logits, into a probability distribution.

Original vector:

$$
[4, 5, 10, 8, 6, 13]
$$

Softmax equation:

$$
\sigma(z_i)
=
\frac{e^{z_i}}
{\sum_{j=1}^{n} e^{z_j}}
$$

Output vector:

$$
\left[
\frac{e^4}{e^4+e^5+e^{10}+e^8+e^6+e^{13}},
\frac{e^5}{e^4+e^5+e^{10}+e^8+e^6+e^{13}},
\frac{e^{10}}{e^4+e^5+e^{10}+e^8+e^6+e^{13}},
\frac{e^8}{e^4+e^5+e^{10}+e^8+e^6+e^{13}},
\frac{e^6}{e^4+e^5+e^{10}+e^8+e^6+e^{13}},
\frac{e^{13}}{e^4+e^5+e^{10}+e^8+e^6+e^{13}}
\right]
$$

**Why do we even need the softmax?**

You cannot train a neural network using the “pick the highest” (Argmax) operation. Argmax is a step function. Its derivative is zero almost everywhere, which means gradients cannot flow back through the network to update the weights. So the soltution is to use the Softmax. Softmax is a “soft” version of Argmax and it’s differentiable. It creates a probability distribution that allows the Cross-Entropy Loss function to measure exactly how far off the prediction was.


## Cross Entropy Loss

The Transformer outputs logits with shape:

$$
(N, L, V)
$$

where:

- $N$ = batch size
- $L$ = sequence length
- $V$ = vocabulary size

There are $N \times L$ target tokens.

For each position, the model produces $V$ logits:

$$
[\text{logit}_1, \text{logit}_2, \ldots, \text{logit}_V]
$$

and compares that whole vocabulary distribution against **one correct token**.

For example, if:

$$
N = 2,\quad L = 3,\quad V = 50{,}000
$$

the output is:

$$
(2, 3, 50000)
$$

and you calculate **6 token-level losses**:

$$
L_{1,1}
=
-\log p(\text{correct token}_{1,1})
$$

$$
L_{1,2}
=
-\log p(\text{correct token}_{1,2})
$$

$$
\cdots
$$

$$
L_{2,3}
=
-\log p(\text{correct token}_{2,3})
$$

Then usually average them:

$$
L_{\text{final}}
=
\frac{1}{NL}
\sum_{n=1}^{N}
\sum_{l=1}^{L}
L_{n,l}
$$

So:

$$
(N, L, V)\ \text{logits}
\rightarrow
(N, L)\ \text{token losses}
\rightarrow
1\ \text{final loss}
$$

### Temperature, Top-K/Top-P Sampling, Beam Search/Greedy Search

*<<This is only for inference time>>*

This is applied to every $(?, ?, V)$ vector individually every time the Transformer predicts the next token.

#### 1. Temperature ($T$)

Applied to the raw logits before Softmax. It changes the “steepness” of the probability hill.

Result:

- If $T = 0.1$: The highest logit becomes massive compared to others; the model becomes extremely confident (almost greedy).
- If $T = 2.0$: The differences between logits shrink; the model becomes “drunk” and picks random words because everything looks equally likely.

#### 2. Greedy & Beam Search

These focus on finding the “best” sequence by looking at the most likely candidates.

- **Greedy Search:** Looks only at the current vector $(V)$ and picks the index with the highest value.
- **Beam Search:** Instead of picking just one, it keeps $B$ (beam width) different versions of the sentence going at once.
- **Example:** If $B = 3$, at each step, it tracks the 3 most likely total sentence paths. At the end, it picks the path with the highest overall cumulative score.

#### 3. Top-K & Top-P (Stochastic/Sampling)

These are used to add “flavor” and variety by sampling from the distribution instead of just picking the winner.

- **Top-K:** The model looks at the vector $(V)$, sorts it, and throws away everything except the top $K$ most likely words.
- **Example ($K = 50$):** Even if there are 50,000 words, it only chooses from the best 50. It then re-normalizes those 50 so they sum to 1 and picks one randomly.
- **Top-P:** Instead of a fixed number of words, it picks a “mass” of probability.
- **Example ($P = 0.9$):** It sorts the words and starts adding them to a list until their combined probability hits 90%. If the model is very sure, the list might only have 2 words. If it’s confused, the list might have 1,000 words.

#### Workflow Order

$$
\text{Logits}
\rightarrow
\text{Temperature}
\rightarrow
\text{Softmax}
\rightarrow
\begin{cases}
\text{Greedy Search} \\
\text{Beam Search} \\
\text{Top-K / Top-P Sampling}
\end{cases}
$$

