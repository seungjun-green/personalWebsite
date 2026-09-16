---
title: Switch Transformer
group: paper-summaries
date: 2026-09-16
---
## Overview

The Switch Transformer makes a language model much larger in *parameter count* without making it proportionally more expensive to run. It achieves this through sparse activation: each input token activates only a small, selected slice of the model rather than the whole network.

In a standard Transformer, parameters and per-token computation are tightly coupled, so a bigger model means every forward pass costs more. The Switch Transformer decouples them. It replaces the single feed-forward network (FFN) in each Transformer block with a large collection of FFNs called *experts*, plus a lightweight *router* that sends each token to just one expert. Adding experts adds parameters, but since each token still visits only one expert, the compute (FLOPs) per token stays roughly constant.

This lets the authors scale to hundreds of billions and even trillions of parameters at a per-token cost comparable to a much smaller dense model, while also improving how fast the model learns per unit of computation. The backbone is T5 (an encoder–decoder Transformer) pretrained on the C4 dataset with a masked span-prediction objective; the Switch modification only changes the FFN sublayers.

## Architecture of the Switch Transformer

The architecture is a standard Transformer in which each FFN sublayer is replaced by a Switch layer. A Switch layer has two parts: a set of $N$ experts (each its own FFN) and a router that assigns each token to one of them.

### The router

Let $x$ be the vector representation of a single token arriving at the layer. The router holds a weight matrix $W_r$ that produces routing logits:

$$h(x) = W_r \, x$$

$h(x)$ has one entry per expert. A softmax turns these logits into a probability distribution over experts:

$$p_i(x) = \frac{e^{h(x)_i}}{\sum_{j=1}^{N} e^{h(x)_j}}$$

$p_i(x)$ is the gate value for expert $i$, meaning how strongly the router thinks token $x$ belongs to expert $i$. These values are non-negative and sum to 1 across experts.

### Switch routing (top-1)

The central idea of the paper is to route each token to a single expert, the one with the highest gate value. The layer output is:

$$y = p_i(x) \, E_i(x), \qquad i = \arg\max_j p_j(x)$$

where $E_i$ is the selected expert. Earlier Mixture-of-Experts work argued the router must send each token to at least two experts ($k \geq 2$) to get a useful learning signal. Switch shows $k = 1$ works, which brings three benefits: cheaper router computation, smaller per-expert token buffers, and less data communicated between devices in distributed settings.

Note that the expert output is still multiplied by its gate value $p_i(x)$. This is not just scaling. Because $p_i(x)$ is differentiable, this multiplication is what lets gradients reach the router weights $W_r$ and train the router even under top-1 routing.

## How it is trained

The model is trained on the span-prediction objective, but two extra pieces make sparse routing behave well: an auxiliary loss added to the objective, and a mechanical capacity limit applied during the forward pass. This section covers the background it builds on, the loss, and then that capacity mechanism.

### Background: Mixture of Experts (MoE)

Switch routing is a simplification of the older Mixture of Experts idea. In standard MoE, the token is routed to the top-$k$ experts (those with the highest gate values), and the layer output is the gate-weighted sum of their outputs:

$$y = \sum_{i \in \mathcal{T}} p_i(x) \, E_i(x)$$

where $\mathcal{T}$ is the set of selected expert indices. Switch is the special case $\mathcal{T} = \{\arg\max_j p_j(x)\}$, i.e. $k = 1$.

### Loss function

The full training objective is the primary task loss plus a scaled auxiliary balancing term:

$$\text{total loss} = \underbrace{\mathcal{L}_{\text{CE}}}_{\text{cross-entropy}} \;+\; \alpha \cdot \underbrace{\left( N \cdot \sum_{i=1}^{N} f_i \cdot P_i \right)}_{\text{load balancing loss}}$$

In words: the model is trained mainly to predict the masked spans correctly ($\mathcal{L}_{\text{CE}}$), and a second term nudges the router to spread tokens evenly across experts. $\alpha$ controls how strongly that balance is enforced ($\alpha = 10^{-2}$), and $N$ is the number of experts. The two terms are unpacked below.

#### Cross-entropy loss

$\mathcal{L}_{\text{CE}}$ is the standard span-prediction cross-entropy of the T5 objective, the ordinary language-modeling loss measuring how well the model predicts the masked target tokens. This is the term the model would be trained on even without any expert machinery.

#### Load balancing loss

Left alone, the router might funnel most tokens to a few favored experts, leaving others idle. The load balancing loss discourages this. For a batch $\mathcal{B}$ of $T$ tokens and $N$ experts, define two per-expert quantities.

The fraction of tokens actually dispatched to expert $i$:

$$f_i = \frac{1}{T} \sum_{x \in \mathcal{B}} \mathbb{1}\{\arg\max_j p_j(x) = i\}$$

where $\mathbb{1}\{\cdot\}$ is 1 when the condition holds and 0 otherwise. And the average router probability assigned to expert $i$:

$$P_i = \frac{1}{T} \sum_{x \in \mathcal{B}} p_i(x)$$

The loss is their scaled dot product:

$$\text{load balancing loss} = \alpha \cdot N \cdot \sum_{i=1}^{N} f_i \cdot P_i$$

Here $f_i$ is the *hard* count of how many tokens went to expert $i$, and $P_i$ is the *soft* confidence the router expressed toward it. Minimizing their product drives the distribution toward uniform. The minimum is reached when both $f_i$ and $P_i$ are near $1/N$ for every expert. The factor $N$ keeps the loss on a consistent scale as the expert count changes. Since $f_i$ is a count (not differentiable) and $P_i$ is differentiable, the gradient flows through the $P_i$ term, giving the router a smooth signal to rebalance while still measuring the actual routing outcome. To understand this clearly see the summed up forward pass below.

#### Forward pass sum up

Let $x \in \mathbb{R}^d$ be the token's vector, and let the router weight matrix be $W_r \in \mathbb{R}^{N \times d}$ ($N$ = number of experts, $d$ = model dimension).

**1. Router logits**

$$h = W_r \, x, \qquad h \in \mathbb{R}^N$$

Each entry $h_i$ is the raw score for expert $i$.

**2. Softmax to gate values**

$$p_i = \frac{e^{h_i}}{\sum_{j=1}^{N} e^{h_j}}$$

$p_i$ is the gate value (probability) for expert $i$.

**3. Pick the expert (top-1)**

$$k = \arg\max_i \; p_i$$

$k$ is the index of the chosen expert.

**4. Layer output**

$$y = p_k \cdot E_k(x)$$

The chosen expert $E_k$ processes the token, and its output is scaled by that expert's gate value $p_k$.

### Expert capacity

Expert capacity is not a loss. It is a mechanical limit applied during the forward pass, so it sits outside the loss function. Because hardware needs fixed tensor shapes, each expert is given a fixed budget of tokens it can process:

$$C = \left(\frac{\text{tokens per batch}}{N}\right) \times \text{capacity factor}$$

$C$ is an absolute count of tokens per expert (e.g. 128 tokens), not a ratio. The first factor is the even share each expert would receive under perfectly uniform routing; the capacity factor ($\geq 1$) adds slack.

How it is used: each expert's input buffer is pre-sized to hold exactly $C$ tokens. As routed tokens fill an expert's buffer in order, any token arriving after the buffer is full overflows and is dropped, receiving no expert output and passing forward only through the residual connection. Experts with fewer than $C$ tokens leave the remaining slots as padding but still compute over the full block, which is the wasted-compute cost of a high capacity factor. This mechanism runs on every forward pass, so it is active during both training and inference; the load balancing loss exists precisely to keep buffers from overflowing.

## Training stability and fine-tuning

Large sparse models are prone to instability, so the paper adds several techniques.

### Selective precision

Low-precision training (bfloat16) is efficient, but the router's softmax is numerically sensitive because exponentials amplify small perturbations. The fix is selective precision: the router's internal computation is done in float32 and cast back to bfloat16 afterward. Since this float32 region is local to the router and not communicated between devices, stability is gained without the communication cost of full float32.

### Smaller initialization

Reducing the weight initialization scale improved stability. The initialization scale factor $s$ is cut by a factor of 10 (from $s = 1.0$ to $s = 0.1$) when drawing from a truncated normal distribution, lowering the risk of exploding activations and gradients early in training.

### Expert dropout

When fine-tuning on smaller downstream tasks, overfitting is a risk. The paper applies a higher dropout rate inside the experts than elsewhere (around 0.4 at the experts vs. 0.1 elsewhere). Because experts hold most of the parameters, concentrating regularization there improves fine-tuning without over-regularizing the shared parts of the network.

## Scaling and parallelism

To train models this large, three forms of parallelism are combined. Data parallelism places different batches on different devices; model parallelism splits individual weight tensors across devices; and expert parallelism places different experts on different devices, so a token routed to a given expert is sent to that expert's device. Switch fits naturally with expert parallelism, and the three can be combined so both the number of experts and the size of each expert grow with the available hardware.

Empirically, at fixed compute per token the Switch Transformer learns substantially faster and reaches better quality than a dense T5 baseline, up to about 7× pretraining speedup to a fixed quality. Scaling the expert count consistently helps, culminating in Switch-C, a model of roughly 1.6 trillion parameters using 2048 experts.

## Distillation to dense models

A large sparse model is powerful but cumbersome to deploy. A trained Switch model can be distilled back into a much smaller dense model, transferring roughly 30% of the sparse model's quality gains into a compact student that is far cheaper to serve, a path from large-scale sparse training to practical dense deployment.

## Summary

In simple terms: during training you train the Switch Transformer architecture with cross-entropy loss plus load balancing loss, while considering expert capacity; and during inference you also consider expert capacity.

## Appendix (Forward pass with shapes)

### Setup and dimensions

Input to the Switch layer: $(B, L, D)$. I'll use $B$ for batch (you wrote $N$, but I'll reserve $N$ for the number of experts to avoid a clash).

- $B$ = batch size
- $L$ = sequence length
- $D$ = model dimension
- $N$ = number of experts
- $D_{ff}$ = expert hidden dimension (the FFN's inner width)

A useful move: routing happens per token, and there are $B \times L$ tokens total. So it's common to flatten:

$$(B, L, D) \;\rightarrow\; (T, D), \qquad T = B \times L$$

Now every token is just a row of dimension $D$, and there are $T$ of them.

### Forward pass with shapes

**Router weight matrix**

$$W_r : (D, N)$$

Maps a $D$-dim token to $N$ logits (one per expert).

**1. Router logits**, for all tokens at once:

$$h = X W_r$$

$$(T, D) \times (D, N) \;\rightarrow\; (T, N)$$

So $h : (T, N)$, each of the $T$ tokens gets $N$ logits. For a single token, $h : (N,)$.

**2. Softmax to gate values** (softmax across the $N$ axis):

$$p = \text{softmax}(h) \;\rightarrow\; (T, N)$$

$p : (T, N)$. Row $t$ is the gate distribution over experts for token $t$. For a single token, $p_i : (N,)$, a vector of $N$ probabilities.

**3. Pick the expert (top-1)**, argmax across the $N$ axis:

$$k = \arg\max_{\text{axis}=N} \; p \;\rightarrow\; (T,)$$

$k : (T,)$, one integer index per token. And $p_k$ (gathering each token's chosen gate value) is:

$$p_k : (T,)$$

a single scalar per token. For one token, $p_k$ is just a scalar $()$.

**4. Experts**

Each expert is an FFN with two linear layers:

$$W_1 : (D, D_{ff}), \qquad W_2 : (D_{ff}, D)$$

For one token $x : (D,)$ routed to expert $k$:

$$E_k(x) = \big(\,\sigma(x W_1)\,\big) W_2$$

$$(D,) \times (D, D_{ff}) \rightarrow (D_{ff},) \;\xrightarrow{\;W_2\;}\; (D,)$$

So $E_k(x) : (D,)$, same dimension as the input token. Stacked over all experts, the full expert parameters are $W_1 : (N, D, D_{ff})$ and $W_2 : (N, D_{ff}, D)$, but each token only touches the one slice indexed by $k$.

**5. Layer output**, scale the chosen expert's output by the chosen gate scalar:

$$y = p_k \cdot E_k(x)$$

$$\underbrace{()}_{\text{scalar}} \times \underbrace{(D,)}_{\text{vector}} \rightarrow (D,)$$

For all tokens: $y : (T, D)$, which reshapes back to $(B, L, D)$, the same shape as the input.
