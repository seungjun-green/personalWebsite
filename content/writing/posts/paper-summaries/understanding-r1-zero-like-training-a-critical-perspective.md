---
title: Understanding R1-Zero-Like Training: A Critical Perspective
group: paper-summaries
date: 2026-09-22
---
# Understanding R1-Zero-Like Training: A Critical Perspective

## Overview

The paper's thesis in one sentence: the impressive results of R1-Zero-style training are over-credited to reinforcement learning. Much of what looks like "RL magic" is either already sitting in the base model or is an artifact of a biased optimizer.R1-Zero training is the DeepSeek recipe of applying RL directly to a base LLM with no supervised fine-tuning first; this paper takes it apart to see where the gains actually come from.

To make that case, the paper decomposes the paradigm into its two ingredients and examines each. This summary follows the same order: first the base model (how much is already there before RL touches it), then the RL algorithm(whether the optimizer is honest about what it's rewarding), and finally the payoff (a cleaner recipe built from both insights). Within the RL section, we go top-down through the math: the general RL objective, then GRPO built on it, then the flaw, then the fix.

---

## Part 1 — Base model: how much is already there before RL?

**Verdict first: the base models already possess most of what R1-Zero appears to "teach."** The authors probe Qwen2.5, Llama-3.1, DeepSeek-Math, and DeepSeek-V3-Base by asking them math questions and analyzing the raw responses. Three findings, from most to least surprising:

- **The "Aha moment" is not created by RL.** Self-reflection behavior (the model catching itself and rechecking) already appears in base models *before* any RL, including DeepSeek-V3-Base, the exact model the real R1-Zero was trained from. They further find self-reflection doesn't reliably correlate with getting the right answer, undercutting the idea that it's the source of the reasoning gains.
- **Base models already solve math.** Once a prompt template flips them from "sentence completer" into "question answerer," the underlying math ability is already present. The template mostly unlocks a capability rather than installing one.
- **The Qwen2.5 anomaly.** Qwen2.5 base models perform best with *no* template at all (~60% better than standard prompting), which suggests they were pretrained on concatenated question–answer text and are effectively SFT-like already. This is a pointed caution: many R1-Zero reproductions are built on Qwen2.5 and credit their gains to RL, when part of the gain was baked in at pretraining.

This part is empirical, so it has no core equation. The evidence is in metrics like answering-rate and pass@8 across models.


### How authors showed proof for above three claims

For most of Part 1 they take **500 questions sampled from the MATH training set** and feed them to a range of base models (Qwen2.5-Math-1.5B/7B, Qwen2.5-7B, Llama-3.1-8B, DeepSeek-Math-7B, and DeepSeek-V3-Base-685B, which they had to host themselves). Then they measure different things depending on the claim.

#### Claim: "base models already answer / already solve math" — templates + a GPT judge

Two pieces here.

First, **do they even answer?** They run each model with *no* template and ask **GPT-4o-mini to classify** each response as either "attempting to answer" or "just continuing/completing the sentence," regardless of whether the answer is correct. That percentage is the "answering rate." Then they try the R1 template and the Qwen-Math template and pick whichever gives the best answering rate per model. This is how they establish that a template is what flips a base model into answering mode.

Second, **can they actually solve it?** They evaluate accuracy on five standard benchmarks (AIME 2024, AMC, MATH500, Minerva Math, OlympiadBench) with the chosen template. They also report pass@8, meaning they sample 8 answers per question and check if *any* is correct, across sampling temperatures. Pass@8 matters specifically for the RL argument: if a base model can't produce even one correct answer, RL has no reward signal to learn from, so this measures whether the base is "RL-ready." So the math-ability claim rests on standard benchmark accuracy plus pass@8, not a vibe check.

#### Claim: the "Aha moment" already exists — keyword + LLM detection, cross-validated

This is the most carefully instrumented one, because "self-reflection" is fuzzy to measure. They use **two detectors and cross-validate them**:

- **Keyword-based:** a deliberately small, strict list of phrases like *recheck, reevaluate, re-examine, reconsider, double-check, think again*. They kept it small on purpose because loose words like "wait" produce false positives.
- **LLM-based:** GPT-4o-mini reads each response and judges whether it shows explicit *or* implicit self-reflection (revisiting steps, questioning assumptions) even without a keyword.

Each method has failure modes, so they **cross-validate**: keyword detection catches cases the LLM over-flags, and the LLM catches implicit reflection the keywords miss. Counting was done at the question level across the 500 questions (a question counts if at least one of its 8 responses shows reflection). This is how they show DeepSeek-V3-Base produces self-reflection *before* any RL, and they include actual example transcripts where it says things like "Aha" and "wait."

The "doesn't correlate with accuracy" part is a *separate* test: they take DeepSeek-R1-Zero, find questions where it produced at least one self-reflective response, sample 100 responses per question, split them into "with reflection" vs "without," and compute the accuracy difference between the two groups. Nearly half the time, reflection didn't yield higher accuracy, hence the claim.

#### Claim: the Qwen2.5 anomaly (~60% jump with no template)

This is the accuracy table (Table 1). They evaluate Qwen2.5-Math models across the five benchmarks under four conditions (4-shot prompting, R1 template, Qwen template, and no template) using greedy decoding capped at 3000 tokens. No template gives the best average, a ~60% relative jump over the 4-shot baseline. The "pretrained on concatenated Q–A text" part is explicitly labeled as a **hypothesis** they infer from this pattern (plus the fact that Qwen2.5-Math is known to use question-answer data in pretraining), not something they proved directly, though in Part 2 they later support it by *reproducing* the effect: they deliberately continual-pretrain a Llama model on concatenated Q–A text and get the same template-free behavior.

So overall: it's inference-time testing, but layered. GPT-judged answering rates, standard benchmark accuracy, pass@8 for RL-readiness, dual-detector cross-validated reflection counting, a 100-sample correlation test, and a multi-condition accuracy table, plus one constructive experiment that recreates the Qwen effect from scratch to back the hypothesis.

---

## Part 2 — RL algorithm: is the optimizer honest?

**Conclusion first: the GRPO optimizer used in R1-Zero contains two hidden biases, and removing them (Dr. GRPO) recovers the correct objective without losing accuracy.** To see the biases, we first need the math of what GRPO is.

### 2a. Prior knowledge — what GRPO is

The general goal of RL post-training is to maximize expected reward. With the KL term dropped (which this paper does, setting $\beta = 0$, since a rule-based verifier removes the usual need to stay near a reference model):

$$J(\pi_\theta) = \mathbb{E}_{q \sim p_Q}\ \mathbb{E}_{o \sim \pi_\theta(\cdot \mid q)}\big[R(q, o)\big]$$

In words: sample a question, sample an answer from the model, and push the model to produce answers that score well.


**$R(q, o)$** is the reward: did the model's answer $o$ to question $q$ come out correct? (1 if yes, 0 if no.)

**$\mathbb{E}_{o \sim \pi_\theta(\cdot \mid q)}[\,\cdot\,]$**: "$\mathbb{E}$" is the average (expected value), and $o \sim \pi_\theta(\cdot \mid q)$ means "$o$ is an answer sampled from the model when given question $q$." So this inner piece says: *for a fixed question, what's the model's average reward across the answers it would produce?* Since reward is 0/1, this is basically the model's probability of getting that question right.

**$\mathbb{E}_{q \sim p_Q}[\,\cdot\,]$**: average again, but this time over questions. $q \sim p_Q$ means "$q$ is drawn from the pool of training questions." So this outer piece says: *average that per-question success rate across all the questions.*

**$J(\pi_\theta)$** is the name for the whole quantity. $\pi_\theta$ is the model (its behavior controlled by parameters $\theta$), and $J$ is the score we're grading it on.

Put together in plain English: **$J$ is how well the model does on average. Pick a random question, let the model answer it, check if it's right, and average that over all questions and all the answers it might give.** Training means adjusting $\theta$ to make $J$ as large as possible, i.e. tweak the model so it gets more questions right more often.

Everything else in the paper (GRPO, the advantage, Dr. GRPO) is just machinery for *how* to climb this $J$ efficiently. This equation is simply the target they're all aiming at.

GRPO is one way to optimize this. Here is the **whole objective first**; we'll then decompose it:

$$J_{\text{GRPO}} = \frac{1}{G}\sum_{i=1}^{G} \frac{1}{|o_i|} \sum_{t=1}^{|o_i|} \min\!\Big( r_{i,t}\,\hat{A}_{i,t},\ \text{clip}(r_{i,t},\, 1-\epsilon,\, 1+\epsilon)\,\hat{A}_{i,t} \Big)$$

For each question, GRPO samples a group of $G$ answers, scores them, and nudges the model toward the good ones and away from the bad ones. Zooming into the parts:

**The probability ratio** measures whether the current model likes a token more or less than the model that generated it:

$$r_{i,t} = \frac{\pi_\theta(o_{i,t} \mid q, o_{i,<t})}{\pi_{\theta_\text{old}}(o_{i,t} \mid q, o_{i,<t})}$$

$r_{i,t} > 1$ means the current model favors that token more than the old one did. The $\text{clip}(\cdot,\,1-\epsilon,\,1+\epsilon)$ caps how far this ratio can move in a single update so the model can't lurch too far at once.

**The reward** is a plain binary correct/incorrect check (no learned reward model, no partial credit):

$$R(q, o_i) = \begin{cases} 1 & \text{if } o_i \text{ contains the correct final answer} \\ 0 & \text{otherwise} \end{cases}$$

**The advantage** turns that reward into a per-token push, by centering it against the group and dividing by the group's spread:

$$\hat{A}_{i,t} = \frac{R(q, o_i) - \text{mean}(R)}{\text{std}(R)}$$

A correct answer lands above the group mean (positive, so push toward it); a wrong one lands below (negative, so push away). Note the two terms that will matter next: the outer $\tfrac{1}{|o_i|}$ (dividing by answer length) and the $\text{std}(R)$ in the denominator.

### 2b. The two biases

Those exact two terms are the problem:

- **The $\tfrac{1}{|o_i|}$ term causes length bias.** Dividing each answer's contribution by its token count means that for a *wrong* answer (negative advantage), a longer answer gets its penalty spread thinner per token, so long wrong answers are punished *less* than short ones. The model learns to pad out its mistakes, and response length creeps up during training. This means the famous "responses get longer as reasoning emerges" story is partly just this optimization artifact, not genuine emergent reasoning.
- **The $\text{std}(R)$ term causes difficulty bias.** When a question is almost always solved or almost always failed, $\text{std}(R)$ is tiny, so dividing by it blows the advantage up and lets that question dominate the update. Very easy and very hard questions get disproportionate weight.

The authors note the length bias isn't unique to GRPO. It silently exists in several popular open-source PPO implementations too.

### 2c. Dr. GRPO — the fix

**The fix is simply to delete those two terms.** Here is the corrected objective, the same as GRPO but with $\tfrac{1}{|o_i|}$ gone:

$$J_{\text{Dr.GRPO}} = \frac{1}{G}\sum_{i=1}^{G} \sum_{t=1}^{|o_i|} \min\!\Big( r_{i,t}\,\hat{A}_{i,t},\ \text{clip}(r_{i,t},\, 1-\epsilon,\, 1+\epsilon)\,\hat{A}_{i,t} \Big)$$

and with the advantage no longer divided by the spread:

$$\hat{A}_{i,t} = R(q, o_i) - \text{mean}(R)$$

What's left is exactly the plain Monte-Carlo policy gradient with a mean baseline, the mathematically unbiased objective GRPO was meant to approximate all along. In practice, Dr. GRPO keeps reasoning accuracy intact while stopping the runaway length growth: it shortens wrong answers and reduces "overthinking," giving better token efficiency.

---

## Part 3 - Payoff: the minimalist recipe

Combining both halves (start from a strong base model, and train it with the unbiased optimizer), the authors build a minimalist recipe: RL-tune Qwen2.5-Math-7B with Dr. GRPO on MATH level 3–5 questions. It reaches **43.3% accuracy on AIME 2024** using only ~27 hours on 8×A100 GPUs, a state-of-the-art result for that setting. The number is the point here, so there's no equation. A corrected optimizer plus an honest read of the base model is enough to beat more elaborate setups.

---

## Summary

The paper is a two-part reality check on R1-Zero training. On the **base-model** side, it shows that math ability and even the "Aha moment" are already present before RL, and that Qwen2.5 models are quietly SFT-like, so gains attributed to "pure RL" are partly pretraining. On the **RL** side, it traces the celebrated growing-response-length phenomenon to two biases in GRPO's objective (the $\tfrac{1}{|o_i|}$ length term and the $\text{std}(R)$ difficulty term) and removes them, yielding **Dr. GRPO**, whose advantage reduces to the clean $\hat{A}_{i,t} = R(q,o_i) - \text{mean}(R)$. Put together, the corrected recipe hits 43.3% on AIME 2024 on modest compute. The overarching lesson: to understand a training method, separate what the base model already knows from what RL genuinely adds, and make sure the optimizer is rewarding correctness rather than quietly gaming length.
