---
title: Qwen 3
group: paper-summaries
date: 2026-09-26
---
# Qwen3 Technical Report — Summary

*Qwen Team, Alibaba · arXiv:2505.09388 · May 2025*

## TL;DR

Qwen3 is an open-weight LLM family (Apache 2.0) with six dense models (0.6B–32B) and two MoE models (30B-A3B, 235B-A22B). Its central idea is that a single model supports both a thinking mode and a non-thinking mode, and users can cap how long the model thinks. The flagship Qwen3-235B-A22B is state of the art among open models at release and competitive with o1, Gemini 2.5 Pro, and GPT-4o. The smaller models are trained cheaply by distilling from the flagships, which beats RL at about 1/10 of the compute.

---

## 1. Overview

> Eight models, one unified reasoning design, broad multilingual coverage.

### 1.1 Model Family

| Model | Type | Total / Active Params | Layers | Heads (Q/KV) | Context |
|---|---|---|---|---|---|
| Qwen3-0.6B | Dense | 0.6B | 28 | 16 / 8 | 32K |
| Qwen3-1.7B | Dense | 1.7B | 28 | 16 / 8 | 32K |
| Qwen3-4B | Dense | 4B | 36 | 32 / 8 | 128K |
| Qwen3-8B | Dense | 8B | 36 | 32 / 8 | 128K |
| Qwen3-14B | Dense | 14B | 40 | 40 / 8 | 128K |
| Qwen3-32B | Dense | 32B | 64 | 64 / 8 | 128K |
| Qwen3-30B-A3B | MoE | 30B / 3B | 48 | 32 / 4 | 128K |
| Qwen3-235B-A22B | MoE | 235B / 22B | 94 | 64 / 4 | 128K |

### 1.2 Key Contributions

#### Unified thinking and non-thinking modes
One model handles both step-by-step reasoning and fast direct replies. Users switch between them with `/think` and `/no_think` flags, so there's no need to deploy a separate chat model and reasoning model.

#### Thinking budget
Users can cap the number of thinking tokens at inference, trading latency for accuracy. Performance rises smoothly as the budget increases.

#### Strong-to-weak distillation
Only the flagships go through the full post-training pipeline. The smaller models learn from them, which cuts compute substantially and gives better results than training them directly with RL.

#### Multilingual and open
Language coverage expands from 29 languages in Qwen2.5 to 119 languages and dialects. All weights are released under Apache 2.0.

---

## 2. Architecture

Qwen3 keeps Qwen2.5's decoder-only Transformer design: grouped-query attention, SwiGLU feed-forward layers, RoPE positional encoding (with the base raised to 1,000,000 via ABF), and pre-norm RMSNorm. It makes two attention changes for training stability: it removes the QKV bias and adds QK-Norm, which normalizes queries and keys per head so the attention logits can't blow up. The MoE variants (30B-A3B and 235B-A22B) replace each feed-forward layer with 128 fine-grained experts, 8 of which are active per token. They drop the shared experts used in Qwen2.5-MoE and use a global-batch load-balancing loss so experts can specialize by domain. All models share a byte-level BPE tokenizer with a 151,669-token vocabulary, and context is 32K for the two smallest models and 128K for the rest (via YaRN at inference).

---

## 3. Pre-training

> 36T tokens across 119 languages, trained in three stages: general, reasoning, and long-context.

### 3.1 Data

#### Scale and language coverage
Compared with Qwen2.5, the corpus has about twice as many tokens (36T) and three times as many languages (119).

#### Data expansion
Qwen2.5-VL extracts text from large volumes of PDF-like documents, and Qwen2.5 then refines it, adding trillions of tokens. Qwen2.5, Qwen2.5-Math, and Qwen2.5-Coder also generate trillions of synthetic tokens, including textbooks, Q&A, instructions, and code.

#### Instance-level mixture optimization
Qwen3 uses a multilingual annotation system to label more than 30T tokens of pre-training data. Every individual document (an "instance") is tagged along several dimensions: its educational value, its field and domain, and its safety. Most prior work sets the data mixture at the level of whole domains (for example, "30% web, 20% code"), which treats every document in a category the same even though quality varies widely within each one. With these labels, Qwen3 can instead select and weight data per instance, keeping or up-weighting high-value documents and dropping or down-weighting low-value ones, whatever domain they come from. And as testing different mixtures on full-size models would be far too expensive, the team runs ablation experiments on small proxy models to compare candidate mixtures and uses the results to choose the final one.

### 3.2 Three-Stage Training

| Stage | Tokens | Sequence length | Purpose |
|---|---|---|---|
| S1: General | 30T+ | 4,096 | Language ability and world knowledge |
| S2: Reasoning | ~5T | 4,096 | STEM, code, and reasoning |
| S3: Long context | Hundreds of billions | 32,768 | Extending the context window |

#### S1: General stage
Every model trains on all 119 languages. Short sequences keep this very large stage computationally affordable.

#### S2: Reasoning stage
The mixture is reweighted toward STEM, coding, reasoning, and synthetic data, and the learning-rate decay is accelerated. This is effectively an annealing phase that consolidates the highest-quality data just before pre-training ends.

#### S3: Long-context stage
The long-context corpus is 75% sequences of 16K–32K tokens and 25% sequences of 4K–16K tokens. Three techniques are involved.

##### RoPE recap
Each dimension pair $i$ of a $d$-dimensional head rotates at its own frequency:

$$\theta_i = b^{-2i/d}$$

At position $m$, pair $i$ is rotated by the angle $m\theta_i$. The query–key dot product then depends only on relative distance:

$$q_m^\top k_n = \mathrm{Re}\Big[\sum_i \tilde q_i \overline{\tilde k_i}\, e^{j(m-n)\theta_i}\Big]$$

The wavelength of pair $i$, meaning the number of tokens per full rotation, is:

$$\lambda_i = \frac{2\pi}{\theta_i}$$

Fast pairs encode fine local order, and slow pairs encode coarse long-range position, like the second, minute, and hour hands of a clock.

#### 3 things that allowed Qwen3 to uses longer sequence

##### ABF (Adjusted Base Frequency)
The RoPE base is raised from $b = 10{,}000$ to $b = 1{,}000{,}000$. This slows every rotation except pair 0, so the slowest wavelength grows from about 54K to about 5M tokens (for $d = 128$). Positions up to 32K therefore stay in a smooth, learnable range. This change is applied during training.

##### YaRN

YaRN extends the context window **at inference only, with no extra training**, by a factor $s$. For Qwen3, $s = 4$, taking the trained length $L = 32{,}768$ to about 128K tokens.

###### The problem past the training length
During training, each RoPE pair rotated through some range of angles between position 0 and position $L$. **Fast pairs** completed thousands of full turns, so every angle appeared many times in training, and positions beyond $L$ produce familiar angles. **Slow pairs** covered only a small arc. After ABF, the slowest pair moves about $1.24 \times 10^{-6}$ rad/token, so it reaches only ~0.04 rad by 32K, but it would reach ~0.16 rad at 128K. That is an angle never seen in training, which makes the input out-of-distribution. The problem is therefore concentrated in the slow pairs.

###### Why not slow every pair down?
The simplest fix, **Position Interpolation**, divides every frequency by $s$:

$$\theta_i' = \theta_i / s$$

This maps 128K positions back into the angle range from training, but it also slows the fast pairs. Pair 0 would move 0.25 rad between neighboring tokens instead of 1 rad, which blurs the fine local order the model depends on.

###### YaRN's per-pair rule
YaRN measures how many full rotations each pair completed within the training length:

$$r_i = \frac{L}{\lambda_i}$$

It then applies a ramp function with thresholds $\alpha = 1$ and $\beta = 32$:

$$\gamma(r) = \begin{cases} 0 & r < \alpha \\ \dfrac{r-\alpha}{\beta-\alpha} & \alpha \le r \le \beta \\ 1 & r > \beta \end{cases}$$

and blends the interpolated and original frequencies for each pair:

$$\theta_i' = \underbrace{\big(1-\gamma(r_i)\big)\frac{\theta_i}{s}}_{\text{slowed-down part}} + \underbrace{\gamma(r_i)\,\theta_i}_{\text{original part}}$$

This gives three regimes. Pairs with $r_i > 32$ are left **unchanged**, since every angle is already familiar and local resolution is preserved. Pairs with $r_i < 1$ are **fully divided by $s$**, which keeps them within the angles seen in training. Pairs in between are **smoothly blended**.

###### Concrete split for Qwen3 (base $10^6$, $d = 128$, $L = 32$K)

| Pairs | Wavelength | Turns in training ($r_i$) | YaRN action |
|---|---|---|---|
| 0 – 23 | ≈ 6 to ~1K tokens | > 32 | unchanged |
| 24 – 39 | ~1K to ~32K tokens | 1 – 32 | blended |
| 40 – 63 | ~32K to ~5M tokens | < 1 | ÷ 4 |

In clock terms, the second and minute hands keep ticking normally, and only the hour hand slows down so the clock can count a longer day.

###### Attention temperature
Attention weights come from a softmax whose denominator sums over **every** token in the context:

$$a_j = \frac{e^{z_j}}{\sum_{k=1}^{n} e^{z_k}}$$

With 4× more tokens, relevant tokens get a smaller share of attention even if their logits are unchanged, so the distribution becomes flatter than anything seen in training. For example, if one relevant token has logit 5 and every distractor has logit 0, its attention weight drops from ≈ 0.60 at $n = 100$ to ≈ 0.27 at $n = 400$.

YaRN compensates by sharpening the softmax with a temperature $t$:

$$\text{softmax}\Big(\frac{q^\top k}{t\sqrt{d}}\Big), \qquad \sqrt{1/t} = 0.1\ln s + 1$$

For $s = 4$, $\sqrt{1/t} \approx 1.14$. In practice, both $q$ and $k$ are scaled by 1.14, and this factor is folded into RoPE's cos/sin tables at no extra cost. The logits therefore grow by $1.14^2 \approx 1.3\times$. In the example above, the relevant logit becomes 6.5 and its weight at $n = 400$ recovers to ≈ 0.62. The $\ln s$ form is an empirical fit from the YaRN paper. It makes sense that the needed boost grows only logarithmically, because $e^{z}$ is exponential, so each multiplication of the number of distractors is offset by adding a constant amount to the logits.


##### Dual Chunk Attention

DCA extends context by changing the relative distances used by RoPE. It divides the sequence into chunks, preserves exact distances within each chunk, and preserves nearby distances across consecutive chunk boundaries. For more distant chunks, it reuses a bounded distance pattern, allowing attention to reach older tokens without introducing distances beyond the training range.

For example, suppose the training length is 8 and the chunk size is 4. For query token 13:

| Keys | Actual distances | Distances used by DCA |
|---|---|---|
| Same chunk: 12–13 | 1, 0 | 1, 0 |
| Previous chunk: 8–11 | 5, 4, 3, 2 | 5, 4, 3, 2 |
| Two chunks back: 4–7 | 9, 8, 7, 6 | 7, 6, 5, 4 |
| Three chunks back: 0–3 | 13, 12, 11, 10 | 7, 6, 5, 4 |

All resulting distances stay within 0–7. The trade-off is that distant chunks share the same positional pattern: their token content remains distinct, but RoPE no longer represents their exact distance from the query.

Together, YaRN and DCA extend Qwen3’s context from 32K to approximately 128K tokens at inference, without additional training.

### 3.3 Hyperparameter Scaling Laws
The team fit scaling laws to predict the optimal learning-rate schedule and batch size for each stage and model size, for both dense and MoE models, instead of tuning them by hand.

---

## 4. Post-training

> Flagships go through a four-stage pipeline, and the lightweight models learn from the flagships by distillation.

### 4.1 Pipeline Overview

The post-training has two design goals. The first is thinking control: one model with both modes and an adjustable reasoning depth. The second is strong-to-weak distillation: building small models cheaply from large ones.

| Path | Models | Method |
|---|---|---|
| Flagship | Qwen3-235B-A22B, Qwen3-32B | Stage 1 → 2 → 3 → 4 |
| Lightweight | 0.6B, 1.7B, 4B, 8B, 14B, 30B-A3B | Off-policy → on-policy distillation from the flagships |

In preliminary experiments, distilling teacher logits into small models gave better pass@1 and pass@64 than running the four stages on each small model, while using only about 1/10 of the GPU hours.

### 4.2 Flagship Four-Stage Pipeline

Stages 1 and 2 build the thinking ability. Stages 3 and 4 add non-thinking ability and general capabilities, all within the same model.

#### Stage 1: Long-CoT cold start
The goal is to instill basic reasoning patterns while deliberately keeping both the sample count and the number of training steps small, so as not to limit what RL can later achieve.

##### Query filtering
The problems cover math, code, logic, and STEM, and each has a verified answer or test cases. Qwen2.5-72B-Instruct is used to remove unverifiable queries (for example, those with multiple sub-questions or open-ended generation) and queries it can already answer correctly without CoT. It also tags each query's domain, to keep the domains balanced.

##### Response filtering
QwQ-32B generates $N$ candidate responses per query, and humans review queries where it consistently fails. Responses are removed if they have a wrong final answer, heavy repetition, guesswork without reasoning, thinking inconsistent with the summary, inappropriate language mixing or style shifts, or suspected overlap with the validation set.

#### Stage 2: Reasoning RL

##### Data
The stage uses 3,995 query–verifier pairs. Each pair was unused in Stage 1, learnable for the cold-start model, as challenging as possible, and drawn from a broad range of sub-domains.

##### Algorithm: GRPO
For each query $q$, the model samples $G$ outputs and normalizes each output's reward against the group:

$$\hat A_{i} = \frac{r_i - \text{mean}(\{r_j\})}{\text{std}(\{r_j\})}$$

$$\mathcal{J}(\theta) = \mathbb{E}\Bigg[\frac{1}{G}\sum_{i=1}^{G}\frac{1}{|o_i|}\sum_{t}\min\Big(\rho_{i,t}\hat A_{i},\; \text{clip}(\rho_{i,t}, 1-\epsilon, 1+\epsilon)\hat A_{i}\Big) - \beta\, D_{\text{KL}}\big(\pi_\theta \,\|\, \pi_{\text{ref}}\big)\Bigg], \quad \rho_{i,t} = \frac{\pi_\theta(o_{i,t}\mid q, o_{i,<t})}{\pi_{\text{old}}(o_{i,t}\mid q, o_{i,<t})}$$

The report names GRPO but gives no equations or hyperparameters of its own.

##### Training observations
Large batch sizes, many rollouts per query, and off-policy updates all helped. Entropy was controlled so that it increased steadily or stayed stable. AIME'24 rose from 70.1 to 85.1 over 170 steps with no manual hyperparameter intervention.

#### Stage 3: Thinking mode fusion
Continual SFT on the Stage 2 model merges both modes into a single model.

##### SFT data construction
Thinking data is produced by rejection sampling with the Stage 2 model itself on Stage 1 queries, which preserves its reasoning ability. Non-thinking data is curated across coding, math, instruction following, multilingual tasks, creative writing, QA, and role-play, and its quality is checked with automatically generated checklists. The proportion of translation tasks is increased to help low-resource languages.

##### Chat template

```
Thinking mode:                      Non-thinking mode:
<|im_start|>user                    <|im_start|>user
{query} /think<|im_end|>            {query} /no_think<|im_end|>
<|im_start|>assistant               <|im_start|>assistant
<think>                             <think>
{thinking content}                  
</think>                            </think>
{response}<|im_end|>                {response}<|im_end|>
```

Thinking is the default, so the `/think` flag is optional. Non-thinking responses keep an empty think block for format consistency. In multi-turn dialogs, flags are randomly inserted across turns, and the model follows the most recent one. In Hugging Face, `enable_thinking=False` disables thinking.

##### Thinking budget (emergent)
When the thinking reaches a user-set limit, generation is halted and the following text is inserted:

> *"Considering the limited time by the user, I have to give the solution based on the thinking directly now.\n</think>.\n\n"*

The model then answers from its partial reasoning. This ability was never explicitly trained. It emerged from learning both the full-thinking and empty-thinking cases.

#### Stage 4: General RL
This stage uses RL across 20+ tasks, in both modes, to broaden the model's capabilities and improve stability. The report doesn't name the RL algorithm used here.

##### Target capabilities
The targets are instruction following (content, format, length, and structured output), format following (correct mode switching and correct use of `<think>` tags), preference alignment (helpfulness, engagement, and style), agent ability (multi-turn tool use with real environment feedback during rollouts), and specialized scenarios such as RAG with reduced hallucination.

##### Three reward types

| Reward | How it works | Best for |
|---|---|---|
| Rule-based | Deterministic checks | Instruction and format following; high precision and resistant to reward hacking |
| Model-based, with reference | Qwen2.5-72B-Instruct scores the response against a reference answer | Tasks with a correct answer but flexible formatting |
| Model-based, without reference | A reward model trained on human preference data gives a scalar score | Open-ended queries with no single correct answer |

### 4.3 Strong-to-Weak Distillation

The six lightweight models start from their own base models and learn from Qwen3-32B or Qwen3-235B-A22B. The report doesn't specify which teacher was paired with which student.

#### Off-policy phase
The teacher generates responses in both `/think` and `/no_think` modes, and the student is fine-tuned on them. This gives the student basic reasoning and mode switching. Its limitation is that the student only ever sees the teacher's clean trajectories, never its own mistakes.

#### On-policy phase
The student generates responses. The teacher then provides its next-token distribution at every position of the student's sequence, and the student minimizes the KL divergence to it:

$$\mathcal{L} = \sum_t \mathrm{KL}\Big(\pi_{\text{teacher}}(\cdot \mid x, y_{<t}) \,\big\|\, \pi_{\text{student}}(\cdot \mid x, y_{<t})\Big), \qquad y \sim \pi_{\text{student}}$$

This corrects the student in exactly the states it actually visits. The report doesn't state whether forward or reverse KL is used.

#### Distillation vs. RL (Qwen3-8B, math and code)
Both methods start from the same off-policy-distilled checkpoint. Numbers in parentheses are pass@64.

| Method | AIME'24 | AIME'25 | MATH500 | LiveCodeBench v5 | GPQA-D | GPU hours |
|---|---|---|---|---|---|---|
| Starting checkpoint | 55.0 (90.0) | 42.8 (83.3) | 92.4 | 42.0 | 55.6 | — |
| + RL | 67.6 (90.0) | 55.5 (83.3) | 94.8 | 52.9 | 61.3 | 17,920 |
| + On-policy distillation | **74.4 (93.3)** | **65.5 (86.7)** | **97.0** | **60.3** | **63.3** | **1,800** |

Pass@1 measures single-sample accuracy, and pass@64 measures whether any of 64 samples succeeds, which reflects what the model *can* solve at all. RL raised pass@1 but left pass@64 unchanged: it made existing solutions more reliable without reaching new problems. Distillation raised both, meaning the teacher expanded the student's reachable solution space. The dense, per-token supervision is also a likely reason it needs far less compute than RL's single scalar reward per sequence.

---

## 5. Evaluation

> State of the art among open models at release, competitive with leading closed models, and strong for its size at every scale.

### 5.1 Base Models

Qwen3-235B-A22B-Base beats DeepSeek-V3-Base on 14 of 15 benchmarks with about 1/3 of the total parameters and 2/3 of the active parameters. It also outperforms Llama-4-Maverick-Base (about 2× the parameters) on most benchmarks, and Qwen2.5-72B-Base on all of them.

| Benchmark | Qwen2.5-72B | Llama-4-Maverick | DeepSeek-V3 | **Qwen3-235B-A22B** |
|---|---|---|---|---|
| MMLU | 86.06 | 85.16 | 87.19 | **87.81** |
| MMLU-Pro | 58.07 | 63.91 | 59.84 | **68.18** |
| GSM8K | 91.50 | 87.72 | 87.57 | **94.39** |
| MATH | 62.12 | 63.32 | 62.62 | **71.84** |
| EvalPlus | 65.93 | 68.38 | 63.75 | **77.60** |

Qwen3 MoE base models match Qwen3 dense base models while using only about 1/5 of the active parameters. Each dense Qwen3 base model roughly matches a Qwen2.5 base model one size up: Qwen3-1.7B/4B/8B/14B/32B match Qwen2.5-3B/7B/14B/32B/72B, and they are often stronger on STEM and code. Qwen3-32B-Base beats Qwen2.5-72B-Base on 10 of 15 benchmarks and Llama-4-Scout-Base on all 15.

### 5.2 Post-trained Flagships

#### Thinking mode
Qwen3-235B-A22B beats DeepSeek-R1 on 17 of 23 benchmarks and is competitive with o1, Grok-3, and Gemini 2.5 Pro.

| Benchmark | OpenAI-o1 | DeepSeek-R1 | Gemini 2.5 Pro | **Qwen3-235B-A22B** |
|---|---|---|---|---|
| AIME'24 | 74.3 | 79.8 | 92.0 | 85.7 |
| AIME'25 | 79.2 | 70.0 | 86.7 | 81.5 |
| LiveCodeBench v5 | 63.9 | 64.3 | 70.4 | **70.7** |
| CodeForces rating | 1891 | 2029 | 2001 | **2056** |
| BFCL v3 | 67.8 | 56.9 | 62.9 | **70.8** |
| GPQA-Diamond | 78.0 | 71.5 | **84.0** | 71.1 |

#### Non-thinking mode
Qwen3-235B-A22B beats GPT-4o (2024-11-20) on 18 of 23 benchmarks. For example, it scores 96.1 vs. 85.3 on Arena-Hard, 40.1 vs. 11.1 on AIME'24, and 1387 vs. 864 on CodeForces rating.

#### Qwen3-32B
In thinking mode, it beats QwQ-32B on 17 of 23 benchmarks and is comparable to o3-mini (medium). In non-thinking mode, it surpasses Qwen2.5-72B-Instruct.

### 5.3 Lightweight Models
Every distilled model outperforms baselines of similar or larger size in both modes. Notably, Qwen3-30B-A3B matches QwQ-32B while using less than 1/10 of the active parameters.

### 5.4 Long Context (RULER)
These results use YaRN with a factor of 4, and a thinking budget of 8,192 tokens in thinking mode.

| Model | Mode | Avg | 128K |
|---|---|---|---|
| Qwen2.5-72B-Instruct | — | 95.1 | 88.4 |
| Qwen3-235B-A22B | Non-thinking | 95.0 | **90.6** |
| Qwen3-235B-A22B | Thinking | 92.2 | 86.0 |

In non-thinking mode, Qwen3 beats Qwen2.5 models of similar size. Thinking mode is slightly worse, likely because reasoning doesn't help pure retrieval tasks and may even interfere with them.

### 5.5 Multilingual
Detailed per-language results cover 12 languages, including Korean, Japanese, Arabic, and Thai. On Belebele, which covers 80 languages, Qwen3 matches Gemma-3 models of similar size and substantially outperforms Qwen2.5.

---

## 6. Analysis & Trade-offs

> The design choices mostly pay off, with some admitted costs and several undisclosed details.

### 6.1 Thinking Budget Scaling
On math, coding, and STEM benchmarks, performance improves smoothly as the thinking budget grows. The authors expect further gains beyond 32K output tokens.

### 6.2 Effects of Stages 3 and 4 (Qwen3-32B)

| Benchmark | Stage 2 (Think) | Stage 3 (Think) | Stage 4 (Think) | Stage 4 (No-think) |
|---|---|---|---|---|
| ThinkFollow* | — | 88.7 | **98.9** | |
| ToolUse* | 63.3 | 70.4 | **85.5** | 86.5 |
| IFEval | 73.0 | 78.4 | **85.0** | 83.2 |
| CounterFactQA* | 50.4 | 61.3 | **68.1** | 66.4 |
| AIME'24 | **83.8** | 81.9 | 81.4 | 31.0 |
| LiveCodeBench v5 | **68.4** | 67.2 | 65.7 | 31.3 |

*\* In-house benchmark. ThinkFollow measures mode-switching accuracy. The ThinkFollow score applies to both modes and is shown once per stage.*

Stage 3 establishes mode switching and improves general ability and instruction following. Stage 4 makes mode switching nearly perfect and strongly boosts tool use and alignment.

### 6.3 Known Limitations
Fusion and general RL slightly *lower* thinking-mode scores on hard math and code (AIME, LiveCodeBench). The authors attribute this to training on broader tasks and deliberately accept it in exchange for versatility. Thinking mode also underperforms non-thinking mode on long-context retrieval.

### 6.4 What the Report Doesn't Disclose
The report contains no equations for any training objective. It doesn't name the RL algorithm for Stage 4, doesn't give RL hyperparameters, and doesn't state the KL direction used in distillation. It also doesn't describe how the preference data for the reward model was collected or how large it is, and it doesn't explain why shared experts were removed. This level of disclosure is typical of industry technical reports.
