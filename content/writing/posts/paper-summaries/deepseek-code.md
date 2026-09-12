---
title: DeepSeek Code
group: paper-summaries
date: 2026-09-12
---
The authors first created the ‘DeepSeek-Coder Base Model’. They then applied instruction fine-tuning to this base model to create the ‘DeepSeek-Coder-Instruct’ model.

## Data

The model was trained on a 2 trillion token dataset composed of 87% source code (from 87 languages), 10% English code-related text (like GitHub Markdown and StackExchange), and 3% Chinese text.

## Training

Before proceeding, it’s important to understand the training strategies discussed in the paper.

* Normal Next-Token Prediction
  The code is kept in its original order, and the model is trained to predict the next token.

* FIM (Fill-in-the-Middle)
  FIM trains the model to generate a missing middle part of the code. The original code is divided into a prefix, middle, and suffix. There are two main FIM formats:

  * PSM (Prefix-Suffix-Middle): The sequence is reordered into Prefix-Suffix-Middle, and the model generates the middle part after seeing the prefix and suffix.
  * SPM (Suffix-Prefix-Middle): The sequence is reordered into Suffix-Prefix-Middle, and the model generates the middle part after seeing the suffix and prefix.

  This paper primarily used the PSM format.

* MSP (Masked Span Prediction)
  Introduced in the T5 paper, MSP masks multiple spans of the original sequence and trains the model to reconstruct the masked parts.

To find the optimal training strategy, the authors conducted experiments on a Python subset of their dataset and evaluated the models on HumanEval, HumanEval-FIM, and MBPP. They found that using 100% FIM achieved the best performance on HumanEval-FIM, but resulted in weaker normal code generation performance. They also found that 50% PSM performed better than MSP.

Based on these results, they used 50% PSM and 50% normal next-token prediction for the final model training, allowing the model to learn both code infilling and normal code generation.


## Architecture

The models were developed in three main sizes: 1.3B, 6.7B, and 33B parameters. The architecture includes:

Rotary Position Embedding (RoPE)
Grouped-Query Attention (GQA) with a group size of 8 for the 33B model
FlashAttention v2


## Optimization

Optimizer: AdamW
Learning Rate Schedule:
A warm-up phase of 2000 steps.
The final learning rate decays to 10% of the initial peak rate.
The learning rate is scaled down at each stage.


## Long Context

DeepSeek-Coder uses RoPE (Rotary Position Embedding) to represent positional information.

The basic idea of RoPE is simple. Each token’s embedding is divided into pairs of two dimensions. For example, if the embedding dimension is \(1024\), each token has \(512\) 2D pairs. Each pair is then rotated by a different angle depending on two things:

* \(m\): the position of the token in the sequence
* \(i\): the index of the 2D pair

For standard RoPE, the rotation frequency of each pair is defined as:

$$
\theta_i = 10000^{-2i/d}
$$

and the actual rotation angle is:

$$
m\theta_i
$$

This means that as the pair index \(i\) increases, \(\theta_i\) becomes smaller, so the later dimension pairs rotate less. On the other hand, as the token position \(m\) increases, the rotation angle becomes larger.

So, in simple terms:

* Earlier dimension pairs rotate more.
* Later dimension pairs rotate less.
* Tokens located further into the sequence rotate more.

For example, if there is a sequence “I love you so much” with an embedding dimension of \(8\), the embedding of each token is divided into four 2D pairs, and each pair is rotated by a different amount according to its position and pair index.

To extend the context length, DeepSeek-Coder changes two parameters of RoPE.

### 1. Scale Down the Token Position

Instead of directly using \(m\), DeepSeek-Coder applies a linear scaling factor of \(4\):

$$
m \rightarrow \frac{m}{4}
$$

Therefore, the rotation becomes:

$$
\frac{m}{4}\theta_i
$$

For example, token position \(320\) is treated as position \(80\):

$$
320 \rightarrow \frac{320}{4} = 80
$$

This makes every dimension pair rotate more slowly as the sequence becomes longer.

### 2. Increase the RoPE Base from 10,000 to 100,000

DeepSeek-Coder also changes:

$$
\theta_i = 10000^{-2i/d}
$$

to:

$$
\theta_i = 100000^{-2i/d}
$$

As shown in the following graph, increasing the base makes \(\theta_i\) smaller for the later dimension pairs, meaning that these pairs rotate even more slowly.

![image](/writing/paper-summaries/deepseek-code/1789211472490-0-image.png)

Combining both changes, the standard RoPE rotation is:

$$
\boxed{
m \cdot 10000^{-2i/d}
}
$$

while DeepSeek-Coder uses approximately:

$$
\boxed{
\frac{m}{4} \cdot 100000^{-2i/d}
}
$$

The difference can be seen more clearly in the following graph, which compares the rotation angle of each dimension pair for the same token position.

![image](/writing/paper-summaries/deepseek-code/1789211479079-0-image.png)

The main idea behind these changes is to make the rotations slower. With standard RoPE, the rotation angle keeps increasing as the token position increases. For very long sequences, some dimensions can therefore rotate around the circle many times, causing their positional patterns to repeat.

By decreasing \(m\) and making \(\theta_i\) smaller, DeepSeek-Coder reduces how quickly these rotations repeat across the sequence. The model can therefore represent positional differences over a much longer range, which helps extend its context length.



