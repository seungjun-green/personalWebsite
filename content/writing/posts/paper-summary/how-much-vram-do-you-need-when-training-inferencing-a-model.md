---
title: How Much VRAM Do You Need When Training/Inferencing a Model?
group: paper-summary
date: 2026-09-08
---
# How Much VRAM Do You Need When Training/Inferencing a Model?

Estimating how much GPU VRAM a model needs is relatively straightforward for model weights, gradients, and optimizer states. Activations are more complicated because their memory usage depends heavily on the model architecture, sequence length, batch size, attention implementation, and whether techniques such as FlashAttention or activation checkpointing are used.

In this article, I'll use a 1B-parameter decoder-only Transformer as a simple example.

For simplicity, model weights and gradients will use FP16 unless stated otherwise.

## Training

During training, the main things consuming VRAM are:

* Model weights
* Optimizer states
* Gradients
* Activations
* Batched inputs
* Framework and CUDA overhead

### Model Weights

This is the simplest part.

Memory usage is approximately:

$$
\text{Memory} = \text{Number of Parameters} \times \text{Bytes per Parameter}
$$

For a 1B-parameter model stored in FP16:

$$
1\text{B} \times 2\text{ bytes} = 2\text{ GB}
$$

So the model weights require approximately 2 GB.

### Optimizer States

Let's use Adam as the optimizer.

Adam maintains two additional values for every trainable parameter:

* First moment (\(m\)): an exponential moving average of the gradients
* Second moment (\(v\)): an exponential moving average of the squared gradients

Both have the same number of elements as the model parameters.

A common training setup stores these optimizer states in FP32 for numerical stability.

Therefore:

$$
1\text{B} \times 4\text{ bytes} \times 2 = 8\text{ GB}
$$

### Gradients

Each trainable parameter needs a corresponding gradient.

The gradient tensor has the same shape as the parameter tensor.

For example, if \(W_Q\) has shape:

$$
(d_{\text{model}}, d_k)
$$

then its gradient has exactly the same shape:

$$
(d_{\text{model}}, d_k)
$$

If gradients are stored in FP16:

$$
1\text{B} \times 2\text{ bytes} = 2\text{ GB}
$$

So gradients require approximately 2 GB for a 1B-parameter model.

### Activations

This is where memory estimation becomes more complicated.

During the forward pass, intermediate tensors need to be retained because they are required later during backpropagation.

Consider a Transformer layer with:

* Batch size: \(N\)
* Sequence length: \(L\)
* Hidden dimension: \(D\)
* Number of attention heads: \(H\)

Some of the important intermediate tensors include:

Multi-Head Attention:

* Q, K, V: approximately \(3 \times (N, L, D)\)
* Attention matrix: \((N, H, L, L)\)
* Attention output: \((N, L, D)\)

Feed-Forward Network:

* Intermediate representation: typically around \((N, L, 4D)\)
* Output: \((N, L, D)\)

LayerNorm, residual connections, dropout, activation functions, and other operations may also require tensors to be saved for backward.

This means activation memory depends strongly on both \(L\) and \(N\).

The particularly expensive part of standard attention is the attention matrix:

$$
(N, H, L, L)
$$

Its size grows quadratically with sequence length.

For example, with:

$$
N = 16,\qquad H = 8,\qquad L = 4096
$$

the attention matrix contains:

$$
16 \times 8 \times 4096 \times 4096
$$

$$
\approx 2.15\text{ billion values}
$$

In FP16:

$$
2.15\text{B} \times 2\text{ bytes} \approx 4.3\text{ GB}
$$

And that is only one attention-sized tensor.

During training, multiple tensors may need to be retained across many Transformer layers, so activation memory can easily become the largest part of VRAM usage.

However, simply adding all intermediate tensor sizes together does not give an exact activation-memory requirement.

Modern implementations use techniques such as:

* FlashAttention
* Activation checkpointing
* Fused kernels
* Memory-efficient LayerNorm
* Recomputation

FlashAttention, for example, avoids materializing the entire \((N, H, L, L)\) attention matrix in GPU memory. This dramatically reduces attention memory usage, especially at long sequence lengths.

Activation checkpointing reduces memory further by discarding some activations during the forward pass and recomputing them during backward.

Because of these optimizations, there is no universal formula such as "a 1B model requires X GB of activation memory."

Activation memory has to be estimated using the actual architecture and training implementation.

### Batched Inputs

Compared with everything above, token IDs themselves are tiny.

Input IDs normally have shape:

$$
(N, L)
$$

PyTorch commonly represents token IDs as int64, meaning 8 bytes per token.

For example:

$$
N = 8,\qquad L = 4096
$$

$$
8 \times 4096 \times 8\text{ bytes} \approx 262\text{ KB}
$$

So the raw input IDs are essentially negligible compared with model weights, optimizer states, gradients, and activations.

### Total Training Memory

For a 1B-parameter model using mixed-precision Adam, a useful starting estimate is:

* Model weights: ~2 GB
* Gradients: ~2 GB
* FP32 Adam states: ~8 GB
* Activations: depends heavily on batch size, sequence length, architecture, FlashAttention, and checkpointing
* Inputs: negligible
* CUDA/framework overhead: additional memory

So before activations are even considered, full fine-tuning can already require roughly:

$$
2 + 2 + 8 = 12\text{ GB}
$$

per 1B parameters.

## Inference

Inference is much cheaper because we do not perform backpropagation.

The main sources of VRAM usage are:

* Model weights
* Temporary activations
* KV cache
* CUDA/framework overhead

### Model Weights

This is the same calculation as before.

For a 1B-parameter model in FP16:

$$
1\text{B} \times 2\text{ bytes} = 2\text{ GB}
$$

Quantization can reduce this further. For example, an INT8 or 8-bit model requires roughly half as much weight memory as FP16, ignoring quantization metadata.

### Optimizer States and Gradients

Inference does not perform backpropagation.

Therefore, we do not need:

* Gradients
* Adam optimizer states
* FP32 master weights

Their memory usage is effectively 0 GB.

This is one of the main reasons inference requires much less VRAM than training.

### Activations

Inference still requires temporary activations, but unlike training, they do not need to be stored for backpropagation.

Autoregressive LLM inference has two stages:

* Prefill: The model processes the entire input at once, such as the system prompt, user prompt, and any provided context.
* Decoding: After prefill, the model generates the response one token at a time.

During prefill, if the input sequence length is \(L\), Q, K, and V are computed for all \(L\) input tokens. With standard attention, the attention matrix has shape:

$$
(N, H, L, L)
$$

For example, with:

$$
N = 16,\qquad H = 8,\qquad L = 4096
$$

the attention matrix contains:

$$
16 \times 8 \times 4096 \times 4096
$$

$$
\approx 2.15\text{ billion values}
$$

In FP16:

$$
2.15\text{B} \times 2\text{ bytes} \approx 4.3\text{ GB}
$$

However, modern implementations such as FlashAttention avoid materializing the entire \(L \times L\) attention matrix in VRAM.

During decoding, the model generates only one new token at a time. Therefore, the current Q contains only one query position, while it attends to all \(T\) tokens in the current context.

The attention score therefore has shape:

$$
(N, H, 1, T)
$$

where \(T\) is the current context length.

This is why attention computation during each decoding step grows linearly with the current context length.

The previously computed K and V are normally stored in the KV cache, so they do not need to be recomputed for all previous tokens at every decoding step.

### KV Cache

During autoregressive inference, the model stores previously computed keys and values so they do not need to be recomputed every time a new token is generated.

For standard Multi-Head Attention, the KV cache for one layer is approximately:

$$
2NLD
$$

The \(2\) comes from storing both K and V.

For example, suppose we have:

* 6 Transformer layers
* Batch size \(N = 16\)
* Sequence length \(L = 4096\)
* Hidden dimension \(D = 2048\)
* FP16 = 2 bytes

Then:

$$
2 \times 6 \times 16 \times 4096 \times 2048 \times 2\text{ bytes}
$$

$$
\approx 3.2\text{ GB}
$$

So the KV cache alone would require approximately 3.2 GB.

For models using MQA or GQA, the KV cache can be significantly smaller because fewer KV heads are stored.

A more general KV-cache formula is:

$$
\text{KV Cache}
=
2
\times N_{\text{layers}}
\times N
\times L
\times H_{\text{KV}}
\times d_{\text{head}}
\times \text{Bytes per Value}
$$

where \(H_{\text{KV}}\) is the number of KV heads.

For ordinary MHA:

$$
H_{\text{KV}} \times d_{\text{head}} = D
$$

so the formula simplifies to:

$$
\text{KV Cache}
=
2
\times N_{\text{layers}}
\times N
\times L
\times D
\times \text{Bytes per Value}
$$

### CUDA and Framework Overhead

Not all VRAM is occupied by tensors that are easy to calculate manually.

Additional memory can be used by:

* CUDA context
* PyTorch or TensorFlow
* Memory allocators
* Temporary kernel buffers
* cuBLAS workspaces
* Attention kernels
* Inference engines such as vLLM

This overhead is not a fixed number.

It can range from hundreds of megabytes to several gigabytes depending on the framework, kernels, GPU, and workload.

## So How Much VRAM Do You Actually Need?

For training, the total VRAM usage is roughly:

$$
\text{Model Weights}
+
\text{Optimizer States}
+
\text{Gradients}
+
\text{Activations}
+
\text{CUDA/Framework Overhead}
$$

For a 1B-parameter model using FP16 weights and gradients with FP32 Adam states:

* Model weights: ~2 GB
* Gradients: ~2 GB
* Adam states: ~8 GB
* Activations: depends on batch size, sequence length, architecture, and memory optimizations
* CUDA/framework overhead: additional memory

So the fixed parameter-related memory is approximately 12 GB before activations and framework overhead are included.

For inference, the total VRAM usage is roughly:

$$
\text{Model Weights}
+
\text{KV Cache}
+
\text{Temporary Activations}
+
\text{CUDA/Framework Overhead}
$$

For the same 1B FP16 model:

* Model weights: ~2 GB
* KV cache: depends mainly on batch size, context length, number of layers, and number of KV heads
* Temporary activations: depends on batch size, context length, and attention implementation
* CUDA/framework overhead: additional memory

So unlike the model weights, the total VRAM requirement cannot be determined from parameter count alone.
