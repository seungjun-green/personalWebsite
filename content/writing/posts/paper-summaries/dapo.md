---
title: DAPO
group: paper-summaries
date: 2026-09-24
---
# DAPO: An Open-Source LLM Reinforcement Learning System at Scale

DAPO is a reinforcement learning algorithm from ByteDance Seed and Tsinghua AIR that improves GRPO with four techniques, taking Qwen2.5-32B to 50 points on AIME 2024 and releasing the full algorithm, code, and dataset openly.

## Overview

Reasoning models like OpenAI's o1 and DeepSeek R1 are trained with large-scale reinforcement learning (RL), but their papers leave out the details needed to reproduce the results. When the authors applied standard GRPO to Qwen2.5-32B, it reached only 30 points on AIME 2024, far below DeepSeek's 47. They identified the causes (entropy collapse, reward noise, and training instability) and fixed them with a new algorithm, DAPO (Decoupled Clip and Dynamic sAmpling Policy Optimization). DAPO reaches 50 points, beating DeepSeek-R1-Zero-Qwen-32B while using only half the training steps.

### Key Contributions

- **The DAPO algorithm:** A modified version of GRPO designed for long chain-of-thought reasoning.
- **Four key techniques:** Clip-Higher, Dynamic Sampling, Token-Level Policy Gradient Loss, and Overlong Reward Shaping.
- **DAPO-Math-17K:** A curated dataset of 17,000 math problems with integer answers.
- **Open-source training code:** Built on the verl framework, so the full system can be reproduced.

---

## Background

DAPO builds on two earlier RL algorithms: PPO, the classic approach, and GRPO, a simpler variant that DeepSeek used. Both work by adjusting the probabilities the model assigns to the tokens it generates.

### How an LLM Generates Tokens

A language model writes one token (roughly a word or word piece) at a time, and before each choice it assigns a probability to every possible next token.

For example, after writing *"First, let's"*, the model might score the options like this:

| Next token | Probability |
|---|---|
| "calculate" | 0.90 |
| "simplify" | 0.05 |
| "draw" | 0.04 |
| "check" | 0.01 |

High-probability tokens like "calculate" are the model's habitual choices, sometimes called **exploitation** tokens. Low-probability tokens like "check" are rare choices, called **exploration** tokens, which can lead to new reasoning paths. RL training works by raising or lowering these probabilities based on whether the resulting answers were good.

### PPO

PPO updates the model while limiting how far each update can move it, which keeps training stable.

#### Objective

$$
J_{\text{PPO}}(\theta) = \mathbb{E}_{(q,a)\sim\mathcal{D},\ o_{\le t}\sim\pi_{\theta_{\text{old}}}(\cdot\mid q)}\left[\min\left(\frac{\pi_\theta(o_t \mid q, o_{<t})}{\pi_{\theta_{\text{old}}}(o_t \mid q, o_{<t})}\hat{A}_t,\ \text{clip}\left(\frac{\pi_\theta(o_t \mid q, o_{<t})}{\pi_{\theta_{\text{old}}}(o_t \mid q, o_{<t})},\,1-\varepsilon,\,1+\varepsilon\right)\hat{A}_t\right)\right]
$$

The fraction compares how likely a token is under the updated model versus the model that generated it. The clip keeps this ratio between $1-\varepsilon$ and $1+\varepsilon$, so no single update changes a token's probability too much.

#### Advantage via GAE

PPO estimates the advantage $\hat{A}_t$ (how much better an action was than expected) using a separately trained value function $V$:

$$
\hat{A}_t^{\text{GAE}(\gamma,\lambda)} = \sum_{l=0}^{\infty}(\gamma\lambda)^l\,\delta_{t+l}, \qquad \delta_l = R_l + \gamma V(s_{l+1}) - V(s_l), \qquad 0 \le \gamma, \lambda \le 1
$$

### GRPO

GRPO removes PPO's value function and instead judges each answer by comparing it with other answers to the same question.

#### Core Idea

For each question, the model generates a group of $G$ answers. Each answer is scored, and its advantage is how far its reward is above or below the group's average. Answers better than the group average are made more likely, and worse ones less likely.

#### Objective

The advantage for answer $i$:

$$
\hat{A}_{i,t} = \frac{R_i - \text{mean}(\{R_j\}_{j=1}^{G})}{\text{std}(\{R_j\}_{j=1}^{G})}
$$

The full objective:

$$
J_{\text{GRPO}}(\theta) = \mathbb{E}_{(q,a)\sim\mathcal{D},\ \{o_i\}_{i=1}^{G}\sim\pi_{\theta_{\text{old}}}(\cdot\mid q)}\left[\frac{1}{G}\sum_{i=1}^{G}\frac{1}{|o_i|}\sum_{t=1}^{|o_i|}\Big(\min\big(r_{i,t}(\theta)\hat{A}_{i,t},\ \text{clip}(r_{i,t}(\theta),\,1-\varepsilon,\,1+\varepsilon)\,\hat{A}_{i,t}\big) - \beta\, D_{KL}(\pi_\theta \,\|\, \pi_{\text{ref}})\Big)\right]
$$

where the probability ratio is:

$$
r_{i,t}(\theta) = \frac{\pi_\theta(o_{i,t} \mid q,\, o_{i,<t})}{\pi_{\theta_{\text{old}}}(o_{i,t} \mid q,\, o_{i,<t})}
$$

#### Symbols

| Symbol | Meaning |
|---|---|
| $q$, $a$ | The question and its correct answer |
| $G$ | Number of answers generated per question |
| $o_i$ | The $i$-th generated answer |
| $\lvert o_i\rvert$ | Length of answer $i$ in tokens (the bars mean "size of") |
| $o_{i,t}$ | The $t$-th token of answer $i$ |
| $R_i$ | Reward for answer $i$ |
| $\hat{A}_{i,t}$ | Advantage of answer $i$, the same for every token $t$ in it |
| $r_{i,t}(\theta)$ | How much more or less likely the updated model makes token $t$ |
| $\beta\, D_{KL}$ | Penalty for drifting away from the original reference model |

#### How the Loss Is Built

Although training ends with a single loss value and one backpropagation, that value is assembled from one term per token.

1. **The reward is per answer.** The rule-based check looks only at the final result, so the whole answer gets one reward.
2. **Every token gets the answer's advantage.** Each token helped produce the answer, so all of them share its score.
3. **Each token contributes one term to the loss.** Simplified (without clipping), each term is $-\hat{A} \times \log(\text{probability of that token})$.
4. **The terms are averaged into one number**, and backpropagation runs once.

For example, if the model answers "x = 5" with three tokens and the answer gets advantage +1:

| Token | Probability | Loss term |
|---|---|---|
| "x" | 0.6 | $-1 \times \log(0.6)$ |
| "=" | 0.9 | $-1 \times \log(0.9)$ |
| "5" | 0.3 | $-1 \times \log(0.3)$ |

Averaging these gives one loss, and backpropagation raises the probability of all three tokens in this context. With a negative advantage, the signs flip and their probabilities are lowered.

In GRPO, the averaging happens in two stages: first within each answer (dividing by $|o_i|$), then across the $G$ answers (dividing by $G$). This detail becomes important for DAPO's Token-Level Loss.

The objective $J$ is maximized, which in practice means minimizing the loss $-J$.

### Two Design Choices DAPO Adopts

DAPO keeps GRPO's group-based approach but makes two simplifying choices about the penalty and the reward.

#### Removing the KL Penalty

The KL term keeps the model close to its starting point. That makes sense when aligning a chat model's behavior, but a reasoning model is supposed to change substantially during training, so the restriction isn't needed. DAPO drops it.

#### Rule-Based Reward

Learned reward models can be exploited by the model being trained, a problem known as reward hacking. DAPO instead checks the final answer directly:

$$
R(\hat{y}, y) =
\begin{cases}
1, & \text{is\_equivalent}(\hat{y}, y) \\
-1, & \text{otherwise}
\end{cases}
$$

where $y$ is the correct answer and $\hat{y}$ is the model's answer.

---

## The Problem: Why Naive GRPO Falls Short

Running standard GRPO on Qwen2.5-32B produced only 30 points on AIME 2024, compared with DeepSeek's reported 47, and other research groups ran into similar difficulties reproducing DeepSeek's results.

### Observed Issues

- **Entropy collapse:** The model quickly became nearly deterministic, producing almost identical answers to the same question and no longer exploring new approaches.
- **Reward noise:** Some rewards sent misleading signals, such as penalizing correct reasoning that was simply cut off for being too long.
- **Training instability:** Answer length and entropy could grow in unhealthy ways, with long answers filling up with gibberish or repeated words.

---

## DAPO

DAPO is GRPO without the KL penalty, plus four techniques that each address one of the observed issues.

### Full Objective

$$
J_{\text{DAPO}}(\theta) = \mathbb{E}_{(q,a)\sim\mathcal{D},\ \{o_i\}_{i=1}^{G}\sim\pi_{\theta_{\text{old}}}(\cdot\mid q)}\left[\frac{1}{\sum_{i=1}^{G}|o_i|}\sum_{i=1}^{G}\sum_{t=1}^{|o_i|}\min\big(r_{i,t}(\theta)\hat{A}_{i,t},\ \text{clip}(r_{i,t}(\theta),\,1-\varepsilon_{\text{low}},\,1+\varepsilon_{\text{high}})\,\hat{A}_{i,t}\big)\right]
$$

$$
\text{subject to}\quad 0 < \big|\{o_i \mid \text{is\_equivalent}(a, o_i)\}\big| < G
$$

The ratio $r_{i,t}(\theta)$ and advantage $\hat{A}_{i,t}$ are defined the same way as in GRPO.

#### What Each Part Does

| Part of the equation | Technique |
|---|---|
| Separate $\varepsilon_{\text{low}}$ and $\varepsilon_{\text{high}}$ in the clip | Clip-Higher |
| Constraint requiring some correct and some wrong answers | Dynamic Sampling |
| Dividing by $\sum_i \lvert o_i\rvert$ (total tokens) | Token-Level Policy Gradient Loss |
| Changes to the reward $R_i$ before computing advantages | Overlong Reward Shaping |

#### Algorithm Overview

Each training step follows the same loop:

1. Sample a batch of questions.
2. Generate $G$ answers for each question with the current model.
3. Score each answer with the reward function.
4. Filter out questions whose answers are all correct or all wrong, and add the rest to a buffer.
5. If the buffer isn't full yet, return to step 1.
6. Once it's full, compute each token's advantage and update the model several times by maximizing the DAPO objective.

### Clip-Higher

Clip-Higher loosens the upper clipping limit so that rare but useful tokens can grow in probability, which keeps the model exploring and prevents entropy collapse.

#### Problem

The standard clip limits each token's probability increase proportionally: with $\varepsilon = 0.2$, a token can rise to at most 1.2 times its old probability. This affects tokens very unevenly:

| Token | Old probability | Upper limit ($\times 1.2$) | Is it restricted? |
|---|---|---|---|
| Common ("calculate") | 0.90 | 1.08 | No, since probability can't exceed 1 anyway |
| Rare ("check") | 0.01 | 0.012 | Yes, it can barely grow |

The 1.08 limit sits above the natural ceiling of 1, so common tokens can climb to 0.999 without ever being stopped. Rare tokens, meanwhile, are held to tiny increases even when they led to correct answers. The authors confirmed this in practice: tokens that hit the upper limit had low average probability (below 0.2).

As a result, habitual choices keep getting stronger while useful rare choices stay suppressed, and the model's answers quickly become nearly identical.

#### Fix

DAPO separates the clip into two limits and raises only the upper one:

$$
\text{clip}\big(r_{i,t}(\theta),\ 1-\varepsilon_{\text{low}},\ 1+\varepsilon_{\text{high}}\big), \qquad \varepsilon_{\text{low}} = 0.2,\quad \varepsilon_{\text{high}} = 0.28
$$

A token at 0.01 can now grow to 0.0128 per update instead of 0.012.

#### Why Keep ε_low Unchanged

Loosening the lower limit would let the model push unlikely tokens down toward zero, which would shrink its range of possible outputs even further.

#### Effect

Entropy stayed healthy instead of collapsing, the model produced more varied answers, and AIME accuracy improved. In the step-by-step results, Clip-Higher raised the score from 36 to 38.

![Figure 2](<https://arxiv.org/html/2503.14476v2/3.1.1.svg>)

The entropy panel of Figure 2 shows the contrast clearly: without Clip-Higher, entropy falls almost to zero, while the Clip-Higher run maintains nonzero entropy throughout the plotted training.



### Dynamic Sampling

Dynamic Sampling ensures every question in a training batch actually produces a learning signal.

#### Problem

If all $G$ answers to a question are correct, they all get the same reward, so every advantage is zero. The same happens if all are wrong. Zero advantage means zero gradient, so these questions contribute nothing to learning. As training progresses and the model solves more questions perfectly, more of each batch becomes useless, which weakens the gradient and makes it noisier.

#### Fix

DAPO only trains on questions with a mix of right and wrong answers:

$$
0 < \big|\{o_i \mid \text{is\_equivalent}(a, o_i)\}\big| < G
$$

This says the number of correct answers must be more than zero and less than $G$.

#### Implementation

Whether a question is useful can only be known after the model attempts it, so DAPO over-generates and filters. It generates answers for a batch of questions, discards the all-correct and all-wrong ones, adds the rest to a buffer, and keeps generating for more questions until the buffer holds the full batch size. Only then does training happen. This is why the sampling cost is described as dynamic: some steps fill the buffer with one round of generation, while others need several.

#### Cost

The extra generation costs less than it seems. A generation round finishes only when its longest answers finish, so much of the time is already spent waiting on a few very long answers. And since every batch is fully useful, the model needs fewer training steps overall, and in the experiments it reached the same performance faster than without Dynamic Sampling.

![Figure 6](<https://arxiv.org/html/2503.14476v2/4.1.1.svg>)

Figure 6 shows the dynamic-sampling run reaching a similar AIME score in substantially fewer steps than the baseline. The dashed markers compare training steps, not elapsed time.



### Token-Level Policy Gradient Loss

Token-Level Loss gives every token equal weight in the loss, so long answers are learned from and penalized properly.

#### Problem

GRPO averages within each answer first, then across answers, so each answer counts equally regardless of length. With two answers of 100 and 1,000 tokens:

| | Answer A (100 tokens) | Answer B (1,000 tokens) |
|---|---|---|
| Weight of the whole answer | 1/2 | 1/2 |
| Weight of each token | 1/200 | 1/2,000 |

Each token in the long answer counts ten times less, which causes two problems:

- **Good long answers teach too little.** Each step of a careful, correct long solution is barely reinforced.
- **Bad long answers aren't punished enough.** Very long answers often contain gibberish or repeated words, and under sample-level loss these patterns receive only a tiny penalty, so answer length and entropy grow in unhealthy ways.

#### Fix

DAPO averages over all tokens at once:

$$
\underbrace{\frac{1}{G}\sum_{i=1}^{G}\frac{1}{|o_i|}\sum_{t=1}^{|o_i|}(\cdots)}_{\text{GRPO: sample-level}} \qquad \longrightarrow \qquad \underbrace{\frac{1}{\sum_{i=1}^{G}|o_i|}\sum_{i=1}^{G}\sum_{t=1}^{|o_i|}(\cdots)}_{\text{DAPO: token-level}}
$$

In the example above, every token now weighs 1/1,100. A pattern that helps or hurts is pushed equally no matter how long the answer containing it is.


#### Effect

| | Answer A (100 tokens) | Answer B (1,000 tokens) |
|---|---|---|
| Weight of the whole answer | 100/1,100 = 1/11 | 1,000/1,100 = 10/11 |
| Weight of each token | 1/1,100 | 1/1,100 |

In DAPO, every token gets the same weight, $\frac{1}{1{,}100}$, because all tokens are averaged together at once. Each answer's total weight then depends on its length, so the 1,000-token answer carries 10 times the weight of the 100-token answer.


It raised the AIME score only from 41 to 42, but its main value is stability: it kept answer length and entropy from growing out of control.

![Figure 8](<https://arxiv.org/html/2503.14476v2/3.3.1.svg>)

The entropy curves illustrate this stability benefit: without token-level loss, entropy rises sharply late in the plotted run, whereas the token-level run shows a much more gradual increase.



### Overlong Reward Shaping

Overlong Reward Shaping separates "wrong" from "too long," so the model isn't told that sound reasoning is incorrect.

#### Problem

Answers have a maximum length, and any answer still going at the limit is cut off. A cut-off answer has no final result, so it gets a reward of −1. But the reasoning may have been correct and simply needed more room. Punishing it sends a misleading signal about what good reasoning looks like, which is a form of reward noise.

#### Fix 1: Overlong Filtering

The simplest fix is to ignore truncated answers, masking their tokens out of the loss so they neither reward nor punish anything. This alone noticeably stabilized training and raised the AIME score from 30 to 36.

#### Fix 2: Soft Overlong Punishment

Instead of an all-or-nothing penalty, DAPO adds a length penalty that grows gradually near the limit:

$$
R_{\text{length}}(y) =
\begin{cases}
0, & |y| \le L_{\max} - L_{\text{cache}} \\[6pt]
\dfrac{(L_{\max} - L_{\text{cache}}) - |y|}{L_{\text{cache}}}, & L_{\max} - L_{\text{cache}} < |y| \le L_{\max} \\[10pt]
-1, & L_{\max} < |y|
\end{cases}
$$

With $L_{\max} = 20{,}480$ and $L_{\text{cache}} = 4{,}096$:

| Answer length | Length penalty |
|---|---|
| Up to 16,384 tokens | 0 |
| 16,384 to 20,480 tokens | Grows smoothly from 0 to −1 |
| Over 20,480 tokens | −1 |

This penalty is added to the correctness reward. A correct answer of 18,432 tokens sits halfway through the penalty zone, so it gets $+1 - 0.5 = +0.5$: still rewarded for being right, just slightly less for being long.

#### Effect

Correct long answers keep their credit, and the model gets a smooth signal to finish before running out of room. Adding Soft Overlong Punishment raised the AIME score from 38 to 41.

### GRPO vs DAPO at a Glance

| Aspect | GRPO | DAPO |
|---|---|---|
| Loss averaging | Within each answer, then across answers | Over all tokens at once |
| Clipping range | $1-\varepsilon$ to $1+\varepsilon$ | $1-\varepsilon_{\text{low}}$ to $1+\varepsilon_{\text{high}}$ |
| KL penalty | Included | Removed |
| Batch filtering | None | Only questions with mixed right and wrong answers |
| Overlong answers | Punished as wrong | Gradual length penalty |

---

## Dataset: DAPO-Math-17K

DAPO-Math-17K contains 17,000 math problems, each rewritten so its answer is a single integer, which makes rule-based checking reliable.

The problems were collected from the web and official competition sites through a combination of scraping and manual annotation.

### Answer Transformation

Math answers come in many forms, such as expressions, formulas, and fractions, and parsing all of them correctly is error-prone. Inspired by AIME, where every answer is an integer, the authors had an LLM rewrite each problem so the expected answer becomes an integer. The rewriting followed four guided steps: extract the answer format, rewrite the problem, solve the rewritten problem, and give the integer answer.

For example, a problem with the original answer $11 - 2\sqrt{6}$ is rewritten to say the answer has the form $k - m\sqrt{n}$ and to ask for $k + m + n$. The new answer is $11 + 2 + 6 = 19$.

---

## Experiments

DAPO trained Qwen2.5-32B from near 0% to 50% on AIME 2024, surpassing DeepSeek-R1-Zero-Qwen-32B (47%) with half the training steps.

### Training Setup

The experiments focus on math, though the authors note the method can transfer to other tasks. Training uses the verl framework, with naive GRPO as the baseline.

#### Batch Structure

- **512 questions per batch**, each with **16 generated answers**, for **8,192 answers** per batch.
- With Dynamic Sampling, all 512 questions have a mix of right and wrong answers.
- Each batch is used for **16 gradient updates** before new answers are generated.

#### Hyperparameters

| Setting | Value |
|---|---|
| Optimizer | AdamW |
| Learning rate | $1 \times 10^{-6}$ (constant), with a 20-step linear warm-up |
| Maximum generation length | 20,480 tokens (16,384 expected + 4,096 soft penalty zone) |
| $\varepsilon_{\text{low}}$, $\varepsilon_{\text{high}}$ | 0.2, 0.28 |
| Evaluation | AIME repeated 32 times, reporting avg@32 |
| Evaluation sampling | Temperature 1.0, top-p 0.7 |

#### Compute Scale

The paper doesn't state its hardware, but the workload requires a large GPU cluster. The model has 32 billion parameters, answers can run to tens of thousands of tokens, and each token requires its own forward pass during generation. With 8,192 answers per batch (plus extras from Dynamic Sampling) over thousands of training steps, generation is typically the most time-consuming part. It's made manageable by generating many answers in parallel across GPUs.

### Main Result

DAPO reached 50 points on AIME 2024, compared with 47 for DeepSeek-R1-Zero-Qwen-32B, and got there in about half the training steps.

![Figure 1](<https://arxiv.org/html/2503.14476v2/score.svg>)

In Figure 1, follow the purple avg@32 curve to DAPO’s 50-point endpoint at roughly 5,300 gradient updates. DeepSeek-R1-Zero-Qwen-32B appears as a 47-point reference at 10,000 updates, rather than as a full training curve.



### Ablation: Contribution of Each Technique

Adding the techniques one at a time shows that each contributes:

| Configuration | AIME 2024 (avg@32) |
|---|---|
| DeepSeek-R1-Zero-Qwen-32B | 47 |
| Naive GRPO | 30 |
| + Overlong Filtering | 36 |
| + Clip-Higher | 38 |
| + Soft Overlong Punishment | 41 |
| + Token-Level Loss | 42 |
| + Dynamic Sampling (full DAPO) | 50 |

### Training Dynamics

Because RL training is a complex system where small changes can have unexpected effects, the authors monitor several metrics to catch problems early.

#### Response Length

Growing answer length gives the model room to explore more complex reasoning, but length doesn't rise steadily. It can plateau or even drop for long periods. The authors use length together with validation accuracy to judge whether a run is going wrong.

#### Reward

Training reward generally rises steadily, showing the model can reliably fit the training set given a good reward signal. However, final training reward correlates poorly with validation accuracy, which indicates overfitting to the training data.

#### Entropy and Generation Probability

Entropy needs to stay within a healthy range. Too low means the model has stopped exploring, and too high tends to produce gibberish and repetition. Generation probability behaves the opposite way. With Clip-Higher, the authors found that a slow, steady rise in entropy was linked to better performance.

### Emergence of Reflective Reasoning

Over training, the model didn't just strengthen existing reasoning patterns; it developed new ones. Early on, it almost never checked or revisited its earlier steps, but later it began pausing to reconsider its approach and backtracking when something didn't work. In one example, the model noticed mid-solution that its result couldn't be a whole number, recognized its method was flawed, and switched to a different approach.

---

## Conclusion

DAPO provides a fully open-source, large-scale RL system for LLM reasoning, including the algorithm, training code, and dataset. Its four techniques (Clip-Higher, Dynamic Sampling, Token-Level Policy Gradient Loss, and Overlong Reward Shaping) address the entropy collapse, wasted gradients, length imbalance, and reward noise that held back standard GRPO. The result is state-of-the-art performance of 50 points on AIME 2024 with Qwen2.5-32B, and a reproducible foundation for the wider research community.
