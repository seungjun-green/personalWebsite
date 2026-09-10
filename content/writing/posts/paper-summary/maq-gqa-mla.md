---
title: MAQ, GQA, MLA
group: paper-summary
date: 2026-09-08
---
MHA already works well, but people have come up with several ways to reduce the computational and memory cost of attention. Some of the major approaches are MQA, GQA, and MLA.

MQA and GQA share a similar idea: use fewer \(W_K\) and \(W_V\) projections. In other words, instead of letting every attention head have its own K and V, multiple heads share them.

The main idea of MLA is to let every head to have its own K and V, but stores it in a compressed latent representation.

In this post, MQA, GQA, and MLA will be explained.

## MQA

![screenshot-2026-09-10-at-8-49-14-pm](/writing/paper-summary/maq-gqa-mla/1789040958465-0-screenshot-2026-09-10-at-8-49-14-pm.png)

Multi-Query Attention means that every head has its own Q, while all heads share a single K and V.

## GQA

![screenshot-2026-09-10-at-8-50-09-pm](/writing/paper-summary/maq-gqa-mla/1789041011857-0-screenshot-2026-09-10-at-8-50-09-pm.png)

Every head has its own Q, while K and V are shared within groups of heads. For example, every 4 heads share one K and V pair. So if there are total 8 heads, there are being only 2Ks and 2 Vs.

## MLA

![screenshot-2026-09-10-at-8-51-39-pm](/writing/paper-summary/maq-gqa-mla/1789041102008-0-screenshot-2026-09-10-at-8-51-39-pm.png)

Multi-Head Latent Attention (MLA) takes a different approach.

Instead of simply reducing the number of K and V representations, MLA keeps the information needed to construct them in a compressed latent representation.

In the DeepSeek paper, MLA is introduced to address a natural concern:

> “MQA and GQA reduce the number of K and V representations, but wouldn’t that hurt the Transformer’s performance?”

To mitigate this, MLA works roughly as follows.

Like standard MHA, each head can still obtain its own Q, K, and V. However, instead of storing the full K and V tensors in the KV cache during inference, MLA stores a compressed latent representation:

$$
C_{KV} = XW_{DKV}
$$

where \(W_{DKV}\) is the down-projection matrix.

When K and V are needed, they can conceptually be projected back to their original dimensions:

$$
K = C_{KV}W_{UK}
$$

$$
V = C_{KV}W_{UV}
$$

where \(W_{UK}\) and \(W_{UV}\) are the up-projection matrices.

By storing \(C_{KV}\) instead of the full K and V tensors, MLA significantly reduces the KV-cache memory footprint and memory I/O during inference.

Here, one question naturally comes up:

> “Wait, doesn’t MLA actually take more time because it has to scale K and V down and then scale them back up?”

The DeepSeek authors handle this by avoiding the explicit reconstruction of the full K and V tensors during attention.

### Standard Attention

For standard attention:

$$
\text{Attention Scores} = QK^\top
$$

For one head, suppose:

$$
Q \in \mathbb{R}^{L \times d_k}
$$

$$
K \in \mathbb{R}^{L \times d_k}
$$

Then:

$$
QK^\top
:
(L,d_k)(d_k,L)
\rightarrow
(L,L)
$$

So the time complexity is:

$$
O(L^2d_k)
$$

where \(L\) is the sequence length.

## MLA

Multi-Head Latent Attention (MLA) takes a different approach.

Instead of simply reducing the number of \(K\) and \(V\) representations, MLA stores the information needed to construct them in a compressed latent representation.

In the DeepSeek paper, MLA is introduced to address a natural concern:

> “MQA and GQA reduce the number of \(K\) and \(V\) representations, but wouldn’t that hurt the Transformer’s performance?”

To mitigate this, MLA works roughly as follows.

Like standard MHA, each head can still obtain its own \(Q\), \(K\), and \(V\). However, instead of storing the full \(K\) and \(V\) tensors in the KV cache during inference, MLA stores a compressed latent representation:

$$
C_{KV} = XW_{DKV}
$$

where \(W_{DKV}\) is the down-projection matrix.

When \(K\) and \(V\) are needed, they can conceptually be projected back to their original dimensions:

$$
K = C_{KV}W_{UK}
$$

$$
V = C_{KV}W_{UV}
$$

where \(W_{UK}\) and \(W_{UV}\) are the up-projection matrices.

By storing \(C_{KV}\) instead of the full \(K\) and \(V\) tensors, MLA significantly reduces the KV-cache memory footprint and memory I/O during inference.

Here, one question naturally comes up:

> “Wait, doesn’t MLA actually take more time because it has to scale \(K\) and \(V\) down and then scale them back up?”

The DeepSeek authors handle this by avoiding the explicit reconstruction of the full \(K\) and \(V\) tensors during attention.

### Standard Attention

For standard attention:

$$
\text{Attention Scores} = QK^\top
$$

For one head, suppose:

$$
Q \in \mathbb{R}^{L \times d_k}
$$

and

$$
K \in \mathbb{R}^{L \times d_k}
$$

Then:

$$
QK^\top :
(L,d_k)(d_k,L)
\rightarrow
(L,L)
$$

So the time complexity is:

$$
O(L^2d_k)
$$

where \(L\) is the sequence length.

## MLA

In MLA, \(K\) can be written as:

$$
K = C_{KV}W_{UK}
$$

Therefore:

$$
QK^\top
=
Q(C_{KV}W_{UK})^\top
$$

Using the transpose rule:

$$
(C_{KV}W_{UK})^\top
=
W_{UK}^\top C_{KV}^\top
$$

so:

$$
QK^\top
=
QW_{UK}^\top C_{KV}^\top
$$

Instead of first reconstructing the full \(K\) tensor, MLA can calculate:

$$
(QW_{UK}^\top)C_{KV}^\top
$$

The first multiplication is:

$$
QW_{UK}^\top
$$

where:

$$
Q \in \mathbb{R}^{L \times d_k}
$$

and

$$
W_{UK}^\top
\in
\mathbb{R}^{d_k \times d_{\text{latent}}}
$$

Therefore:

$$
(L,d_k)
(d_k,d_{\text{latent}})
\rightarrow
(L,d_{\text{latent}})
$$

with time complexity:

$$
O(Ld_kd_{\text{latent}})
$$

The second multiplication is:

$$
(QW_{UK}^\top)C_{KV}^\top
$$

with:

$$
(L,d_{\text{latent}})
(d_{\text{latent}},L)
\rightarrow
(L,L)
$$

and time complexity:

$$
O(L^2d_{\text{latent}})
$$

So the total arithmetic cost in this simplified per-head view is:

$$
O(Ld_kd_{\text{latent}} + L^2d_{\text{latent}})
$$

The main advantage of MLA, however, is not simply that its FLOP complexity is always lower than standard MHA. The main benefit is that it does not need to store and repeatedly read the full \(K\) and \(V\) tensors from the KV cache.

Instead, it stores the much smaller \(C_{KV}\), while the up-projection matrices can be absorbed into the surrounding attention computation.

This significantly reduces KV-cache memory usage and memory I/O during autoregressive inference.
