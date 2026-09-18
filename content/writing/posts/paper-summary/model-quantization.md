---
title: Model Quantization
group: paper-summary
date: 2026-09-18
---
# Model Quantization: Concepts, Methods, and Why It Matters

## Overview

Quantization reduces the numerical precision of a model's parameters, for example from FP32 to FP8, so that large models fit and run on constrained hardware. Lower precision shrinks the memory footprint, speeds up inference, and lowers power consumption, at the cost of some accuracy. The right balance between accuracy and efficiency depends on the use case.

This summary first frames quantization as a small set of independent choices, then works through each in turn: what gets quantized, how the mapping and its scale are set, how finely parameters are grouped, and when in the model's life quantization happens.

## Why quantize

As models grow, especially generative models, they strain hardware along three axes: memory usage, inference speed, and energy consumption. Quantization addresses all three by representing weights and/or activations with fewer bits. Reducing precision decreases model size and computational cost, which enables faster inference and lower power draw than the original model.

The tradeoff is accuracy. Quantization introduces some degradation relative to the full-precision model. How much degradation is acceptable, and therefore how aggressively to quantize, is use-case dependent.

## The big picture: quantization as a set of choices

Quantization is easiest to hold in your head as several independent questions. A real setup answers one from each line, and the answers combine freely, for example post-training plus symmetric plus weight-only plus per-channel plus AbsMax.

- When do you quantize? Post-training (PTQ), or during training (QAT).
- How do you map the numbers? Affine, or symmetric.
- What do you quantize? Weights, activations, or the KV cache.
- How finely do you group? Per-tensor, per-channel, or per-block.
- How do you pick the scale? AbsMax, or a smarter method such as AWQ, GPTQ, or SmoothQuant.

These are separate axes: a choice on one line does not fix a choice on another, and a real setup mixes them freely. The rest of this summary takes them roughly in order: what gets quantized, then the how axes (mapping, scale, granularity), then the when axis.

## What gets quantized

### Data types

The data type used to store parameters directly determines the compute a model needs, and therefore its speed and efficiency. A floating-point number uses $n$ bits split into three parts:

- Sign: a single bit, 0 for positive and 1 for negative.
- Exponent: encodes the power to which the base (2 in binary systems) is raised, and defines the range of the type.
- Significand, or mantissa: the significant digits, whose length largely determines precision.

The value is reconstructed as:

$$x = (-1)^{\text{sign}} \times 2^{\text{exponent}} \times \text{mantissa}$$

Because the split between exponent and mantissa bits can vary, a format is often named by that split. FP8 in E4M3 form uses 4 exponent bits and 3 mantissa bits. More exponent bits widen the range; more mantissa bits sharpen precision. This is the central tension across FP16, BF16, FP8, and FP4: for a fixed bit budget, range trades against precision.

### The three targets

In today's transformer-based models, three things can be quantized: model weights, model activations, and the KV cache.

Weights are the static, stored parameters, and quantizing them is the most direct way to cut the memory footprint. If Llama2 7B is stored in FP16 or BF16, each of its 7 billion parameters takes 2 bytes, roughly 14 GB in total. Quantizing the weights to FP8 halves that to about 7 GB.

Activations are the intermediate outputs each layer produces during inference. They are dynamic and are not stored in the model, but quantizing them lets inference use specialized tensor-core hardware whose throughput scales as bit width falls, which improves speed.

The KV cache applies only to decoder models, which generate tokens autoregressively and cache keys and values to avoid recomputation. Its size grows with sequence length and with the number of layers and heads, so for a long context (for example 4096 tokens on Llama2 7B) it can add several gigabytes to the footprint, making it a worthwhile third target.

## How you quantize

This part covers three of the axes: how you map values, how you pick the scale for that mapping, and how finely you group the parameters. All three are independent of what you are quantizing, so each applies to weights, activations, or the KV cache alike.

### Mapping the numbers: affine and symmetric

Quantization maps a real value $x \in [\alpha, \beta]$ to a low-precision value $x_q \in [\alpha_q, \beta_q]$. For example, mapping an FP16 value to FP8 E4M3 narrows the representable range from roughly $x \in [-65504, 65504]$ down to $x_q \in [-448, 448]$. How the mapping places the real zero determines which of two schemes is used.

#### Affine quantization

Affine, also called asymmetric, quantization is defined by two parameters: a scale factor $s$, a positive real number that sets the quantizer's step size, and a zero-point $z$, stored in the same type as $x_q$, which guarantees that the real value zero maps exactly. Mapping zero exactly matters because neural network operators are often implemented efficiently by zero-padding arrays at their boundaries.

With $s$ and $z$ fixed, a value is quantized by:

$$x_q = \text{clip}\left(\text{round}\left(\frac{x}{s} + z\right), \alpha_q, \beta_q\right)$$

Here $\frac{x}{s}$ rescales the value into the quantized range, adding $z$ shifts it so real zero lands on $z$, round snaps the result to the nearest representable level, and clip holds it inside $[\alpha_q, \beta_q]$. The approximate original value is recovered by inverting the scale and shift:

$$x \approx x' = s \cdot (x_q - z)$$

Rounding and clipping each discard information, so quantizing and then dequantizing does not return $x$ exactly. These rounding and clipping errors are inherent to the process.

#### Symmetric quantization

Symmetric quantization is the special case where the zero-point is fixed at $z = 0$. Real zero then maps directly to quantized zero, which removes the added constant and the addition operations it brings, lowering overhead:

$$x_q = \text{clip}\left(\text{round}\left(\frac{x}{s}\right), \alpha_q, \beta_q\right)$$

$$x \approx x' = s \cdot x_q$$

Asymmetric quantization does not buy much accuracy over the symmetric case, so the simpler symmetric form is the practical default, and it is what NVIDIA TensorRT and Model Optimizer use.

### Picking the scale factor

Both schemes need a scale factor $s$, so how you compute $s$ is its own choice. The basic method is AbsMax, and the advanced methods below are smarter ways to make the same choice, several of them reducing accuracy loss by treating some values more carefully than others.

#### AbsMax

AbsMax sets the scale from the data's extreme magnitude, chosen for being simple and effective. The form shown here is the symmetric one: it sizes the step so that the larger of the two input extremes fills a zero-centered quantized range.

$$s = \frac{2 \cdot \max(|x_{max}|, |x_{min}|)}{\beta_q - \alpha_q}$$

The numerator is the width of the real data, taken symmetrically from whichever extreme is larger in magnitude; the denominator is the width of the target quantized range. The general idea, use the data's extreme magnitude to set the step size, applies just as well to affine quantization, where the scale would instead span the actual $[\alpha, \beta]$ and pair with a separate zero-point.

For a worked FP16 to FP8 example with $x_{max} = 12.8$ and $x_{min} = -6.2$, mapping into $[-448, 448]$:

$$s = \frac{2 \cdot \max(|12.8|, |-6.2|)}{448 - (-448)} = \frac{25.6}{896} \approx 0.028$$

A value $x = 6.4$ then quantizes to:

$$x_q = \text{clip}\left(\text{round}\left(\frac{6.4}{0.028}\right), -448, 448\right)$$

where the scaled value $\frac{6.4}{0.028} \approx 228.57$ lies well inside $[-448, 448]$, so rounding and clipping keep it in range.

#### Advanced methods: AWQ, GPTQ, SmoothQuant

Beyond plain AbsMax, several methods reduce accuracy loss further. Three are widely adopted. Unlike the mapping and granularity choices, which apply to any target, each of these fixes the target it works on. All three are applied to an already-trained model, so on the timing axis they are post-training quantization.

Activation-aware Weight Quantization (AWQ) is weight-only. It uses activation statistics gathered during calibration to find the small fraction of salient weight channels that matter most to model quality, then applies per-channel scaling to protect them, which cuts error and enables low-bit weight quantization.

Generative Pre-trained Transformer Quantization (GPTQ) is also weight-only. It quantizes each row of a weight matrix independently, using approximate second-order information, the Hessian, to guide the process so that the output error introduced by quantization is minimized. This yields accurate compression with little quality loss.

SmoothQuant targets 8-bit quantization of both weights and activations. It applies a mathematically equivalent per-channel scaling that smooths activation outliers, shifting the difficulty from activations onto weights, which preserves accuracy while keeping the hardware-friendly form.

### Choosing the granularity

Granularity is the level at which quantization parameters are shared across a tensor's elements, equivalently the level at which the $x_{max}$ and $x_{min}$ of AbsMax are computed. Because weights, activations, and the KV cache are all tensors, granularity applies to any of them. Three strategies are common, trading simplicity against error.

Per-tensor (or per-layer) quantization uses one set of parameters for the whole tensor. It is the simplest and most memory efficient, but a single scale across the whole tensor raises error when the value distribution varies across dimensions.

Per-channel quantization uses separate parameters for each channel, typically along the channel dimension in convolutions. Isolating each channel confines the effect of an outlier to its own channel instead of letting it stretch the scale for the entire tensor, which lowers error.

Per-block (or per-group) quantization divides the tensor into smaller blocks, each with its own parameters. It is the most fine-grained of the three and helps most when different regions of the tensor have different distributions.

## When you quantize

The timing axis has two options, and they trade cost against accuracy. Post-training quantization (PTQ) quantizes a model after it is fully trained, which is cheap and fast since there is no retraining, but because the model never learned to cope with low precision it can lose some accuracy. Quantization-aware training (QAT) instead folds quantization into training, so the model learns to tolerate it and recovers more accuracy, at the cost of an actual training run. This axis is independent of the earlier choices: whichever mapping, scale method, target, and granularity you use, you still apply them either after training or during it.

### Post-training quantization (PTQ)

PTQ quantizes an already-trained model. It comes in two forms, depending on what you quantize.

Weight-only quantization converts just the weights. Because weights are fixed numbers already sitting in the model, this needs no data: you map them to lower precision using the computed scale, with or without a zero-point.

Quantizing weights and activations together needs some sample data, because activations exist only when data flows through the model. When activations are included, there is one further split, on when their scale is measured. Static quantization measures once on a calibration dataset, then fixes the scale and reuses it for all future inference. Dynamic quantization computes the scale on the fly for each input, needing no calibration data but doing a little extra work per inference. This static-versus-dynamic choice is the one sub-decision that exists only because you picked PTQ; every other choice is an independent axis that PTQ merely combines with.

The measuring step for activations is called calibration. It attaches observers to each activation of interest, runs representative data through the model, and records how large the activations get, all while leaving the weights unchanged. Under AbsMax, the recorded value is the largest absolute activation seen:

$$y_{max} = \max(|y_0|, \dots, |y_N|)$$

where $y_i$ is the activation for data sample $d_i$. The scale is then derived from $y_{max}$.

### Quantization-aware training (QAT)

QAT bakes quantization into training so the model can adapt to it, which recovers more of the accuracy that quantization would otherwise cost. It does this by simulating low-precision arithmetic during both the forward and backward passes, using fake quantization modules that quantize and then dequantize weights and activations. The model therefore experiences quantization effects while gradients are still computed in high precision. Typically these modules are frozen while the model's weights are fine-tuned.

One obstacle is that quantization functions like round are non-differentiable, which would block gradients. QAT handles this with the straight-through estimator (STE), which approximates the gradient of these functions as the identity during backpropagation, letting training proceed through the non-differentiable steps.

## Summary

Quantization stores a model's numbers in fewer bits to save memory, speed up inference, and cut power, accepting a little accuracy loss in return. It is best seen as a set of independent choices: what you quantize (weights, activations, or the KV cache), how you map values (affine or symmetric), how you pick the scale for that mapping (AbsMax or a smarter method like AWQ, GPTQ, or SmoothQuant), how finely you group the parameters (per-tensor, per-channel, or per-block), and when you do it (after training as PTQ, or during training as QAT). The number formats underneath trade range against precision, the mapping and its scale turn real values into a small integer range, granularity decides how many scales you keep, and the timing axis decides whether the model merely tolerates low precision or actively learns to, with the straight-through estimator making training through quantization possible. A real deployment picks one answer per axis and combines them.
