---
title: Understanding Policy Gradient, PPO, RLOO, and GRPO
group: paper-summary
date: 2026-09-04
---
This blog summarizes the main RL methods used in LLM post-training and the notation commonly used in their objectives.

A useful high-level picture is:

$$
\text{Policy Gradient}
\rightarrow
\text{REINFORCE + Baseline / RLOO}
\rightarrow
\text{TRPO / PPO}
\rightarrow
\text{GRPO: group-based baseline + PPO-style clipping}
$$

The core idea across all of them is simple:

> Generate outputs, score them, and update the model so that better outputs become more likely and worse outputs become less likely.

---

## Notations

### $o_i$

The $i$-th generated response.

Example:

```text
Prompt: Solve 2 + 2

o_1 = "The answer is 4"
o_2 = "The answer is 5"
```

If we generate $G$ responses, then:

$$
o_1, o_2, \dots, o_G
$$

### $a_{i,t}$

Token $t$ inside response $i$.

For:

```text
o_i = "The answer is 4"
```

the tokens could be:

```text
["The", " answer", " is", " 4"]
```

### $|o_i|$

The number of tokens in response $i$.

### $s_{i,t}$

The context before generating token $a_{i,t}$.

It contains:

$$
\text{original prompt} + \text{previously generated tokens}
$$

For example, when generating `"4"` in:

```text
Prompt: Solve 2 + 2
Response so far: The answer is
```

then $s_{i,t}$ is roughly:

```text
Solve 2 + 2 + The answer is
```

### $R_i$

The reward assigned to response $o_i$.

Conceptually:

$$
R_i = \text{RewardFunction}(\text{prompt}, o_i)
$$

For example:

```text
Correct answer   -> R = 1
Incorrect answer -> R = 0
```

The reward does not always have to come from a reward model. It can also come from a rule-based verifier, exact answer matching, test execution, etc.

### $\pi_\theta$

The current policy being trained.

For LLMs:

$$
\pi_\theta = \text{the current language model}
$$

The parameters $\theta$ are updated during training.

### $\pi_{\text{old}}$

A frozen snapshot of the policy before the current update.

It is used to measure how much the current policy has changed.

### $\pi_{\text{ref}}$

A frozen reference model, often the original SFT model before RL training.

Its purpose is to keep the RL-trained policy from drifting too far away.

$$
\boxed{
\pi_\theta = \text{model currently changing}
}
$$

$$
\boxed{
\pi_{\text{old}} = \text{short-term snapshot}
}
$$

$$
\boxed{
\pi_{\text{ref}} = \text{long-term reference model}
}
$$

### $\rho_{i,t}$

The policy probability ratio:

$$
\rho_{i,t}
=
\frac{
\pi_\theta(a_{i,t}\mid s_{i,t})
}{
\pi_{\text{old}}(a_{i,t}\mid s_{i,t})
}
$$

It measures how much the probability of one specific token changed.

- $\rho=1$: probability did not change
- $\rho=1.5$: token became 50% more likely
- $\rho=0.8$: token became 20% less likely

### $D_{KL}$

KL divergence measures how different the old policy and the current policy are.

For a state $s$, compare the action probabilities assigned by $\pi_{\text{old}}$ and $\pi_\theta$:

$$
D_{KL}
\left(
\pi_{\text{old}}(\cdot\mid s)
\parallel
\pi_\theta(\cdot\mid s)
\right)
=
\sum_a
\pi_{\text{old}}(a\mid s)
\log
\frac{
\pi_{\text{old}}(a\mid s)
}{
\pi_\theta(a\mid s)
}
$$

The sum considers every possible action $a$. For an LLM, the actions are the possible next tokens. If $\pi_{\text{old}}$ and $\pi_\theta$ assign similar probabilities, the KL divergence is small. If their probabilities differ substantially, it is larger.

$$
\boxed{
\rho = \text{change for one selected token/action}
}
$$

$$
\boxed{
D_{KL} = \text{overall difference between policy distributions}
}
$$

### $\mu_G$

The average reward in a group of generated responses.

Suppose:

$$
R=[1,1,0,0]
$$

Then:

$$
\mu_G
=
\frac{1+1+0+0}{4}
=
0.5
$$

So:

$$
\boxed{
\mu_G = \text{average score of the group}
}
$$

### $\sigma_G$

The standard deviation of rewards inside the group.

It measures how spread out the rewards are.

For a group containing $G$ rewards:

$$
\sigma_G
=
\sqrt{
\frac{1}{G}
\sum_{i=1}^{G}
(R_i-\mu_G)^2
}
$$

Compare:

$$
[0.5,0.5,0.5,0.5]
$$

and:

$$
[1,1,0,0]
$$

Both have mean $0.5$, but the first group has no spread while the second has more variation.

$$
\boxed{
\sigma_G = \text{how different the rewards are from each other}
}
$$

### $A_i$ or $\hat A_i$

The advantage.

It tells the model whether a response was better or worse than some baseline.

- $A_i>0$: increase the probability of the response
- $A_i<0$: decrease the probability of the response

In GRPO:

$$
A_i
=
\frac{R_i-\mu_G}{\sigma_G}
$$

### $\operatorname{sg}[x]$

`sg` means stop-gradient.

The value of $x$ is used normally in the forward pass, but no gradient flows through it during backpropagation.

```text
forward:
x --------> loss

backward:
x | STOP <-------- loss
```

$$
\boxed{
\operatorname{sg}[x]
=
\text{treat }x\text{ as a constant during backpropagation}
}
$$

### $\operatorname{clip}(x,l,h)$

Clipping makes sure that $x$ stays within the range from the lower bound $l$ to the upper bound $h$:

- If $x<l$, set it to $l$.
- If $x>h$, set it to $h$.
- If $l\le x\le h$, leave it unchanged.

Equivalently:

$$
\operatorname{clip}(x,l,h)
=
\begin{cases}
l, & x<l \\
x, & l\le x\le h \\
h, & x>h
\end{cases}
$$

For example:

$$
\operatorname{clip}(1.5,0.8,1.2)=1.2
$$

$$
\operatorname{clip}(0.6,0.8,1.2)=0.8
$$

$$
\operatorname{clip}(1.0,0.8,1.2)=1.0
$$

PPO and GRPO use clipping to stop the policy from changing too much in one update.

---

## Methods

### 1. Policy Gradient

Policy Gradient uses the simplest RL idea:

> If an action leads to high reward, make it more likely next time.

For an LLM:

$$
L
=
-R_i \log \pi_\theta(o_i)
$$

At token level:

$$
L
=
-R_i
\sum_t
\log \pi_\theta(a_{i,t}\mid s_{i,t})
$$

If $R_i>0$, the generated response becomes more likely.

If $R_i<0$, it becomes less likely.

$$
\boxed{
\text{reward} \times \text{log probability}
}
$$

From this basic idea, later methods improve either how the reward is compared against a baseline or how much the policy is allowed to change in one update.

### 2. REINFORCE + Baseline

Plain Policy Gradient uses raw reward.

REINFORCE + baseline instead asks:

> Was this reward better or worse than what we expected?

The objective becomes:

$$
L
=
-(R_i-b)\log \pi_\theta(o_i)
$$

where $b$ is the baseline.

Example:

$$
b=0.6
$$

If $R_i=0.9$:

$$
R_i-b=0.3
$$

The response was better than expected.

If $R_i=0.2$:

$$
R_i-b=-0.4
$$

The response was worse than expected.

$$
\boxed{
\text{Policy Gradient: use }R
}
$$

$$
\boxed{
\text{REINFORCE + baseline: use }R-b
}
$$

The baseline reduces variance and makes training more stable.

RLOO follows this same idea, but calculates the baseline from a group of answers generated for the same prompt.

### 3. RLOO

RLOO stands for **REINFORCE Leave-One-Out**.

It is REINFORCE + baseline with a specific group-based baseline: each response is compared against the other responses generated for the same prompt.

A simplified main objective is:

$$
L_{\text{RLOO}}
=
-\frac{1}{G}
\sum_{i=1}^{G}
A_i
\sum_{t=1}^{|o_i|}
\log \pi_\theta(a_{i,t}\mid s_{i,t})
$$

where $G$ is the number of responses generated for one prompt, $o_i$ is response $i$, and $A_i$ is the advantage assigned to that response. Each $A_i$ weights the log-probability of the response that produced it.

RLOO calculates $A_i$ using the mean reward of the **other responses** as its baseline:

$$
b_i
=
\frac{1}{G-1}
\sum_{j\ne i}R_j
$$

where $b_i$ is the leave-one-out baseline for response $i$. The corresponding advantage is:

$$
A_i=R_i-b_i
$$

For example, suppose one prompt produces $G=4$ responses with rewards:

$$
R=[1.0,0.8,0.2,0.0]
$$

For response 1:

$$
b_1
=
\frac{0.8+0.2+0.0}{3}
=
0.333
$$

Then:

$$
A_1
=
1.0-0.333
=
0.667
$$

For response 3:

$$
b_3
=
\frac{1.0+0.8+0.0}{3}
=
0.6
$$

so:

$$
A_3
=
0.2-0.6
=
-0.4
$$

Therefore, $A_i$ is applied only to response $o_i$:

- If $A_i>0$, increase the probability of the tokens in $o_i$.
- If $A_i<0$, decrease the probability of the tokens in $o_i$.
- If $A_i\approx 0$, make little or no update from $o_i$.

The advantages are treated as fixed values during this policy update; the gradient changes $\pi_\theta$, not the computed $A_i$ values.

$$
\boxed{
\text{RLOO = compare each response against the other responses in the group}
}
$$

A major benefit is that it does not require a separate value model.

### 4. TRPO

TRPO stands for **Trust Region Policy Optimization**.

Like the previous methods, TRPO uses an advantage $A$ to decide which actions should become more or less likely. Its main additional concern is preventing the policy from changing too much in one update.

Its main idea is:

> Improve the policy, but do not let it move too far in one update.

It approximately maximizes:

$$
\rho A
$$

while enforcing:

$$
D_{KL}
(
\pi_{\text{old}}
\|
\pi_\theta
)
\le \delta
$$

So TRPO has two jobs:

1. Improve actions with positive advantage.
2. Keep the new policy close to the old policy.

The problem is that enforcing the KL constraint is computationally complicated.

### 5. PPO

PPO stands for **Proximal Policy Optimization**.

It tries to get the same basic behavior as TRPO, but in a simpler way.

Instead of explicitly solving a constrained KL optimization problem, PPO clips the probability ratio.

The core objective is:

$$
\min
\left(
\rho A,\;
\operatorname{clip}(\rho,1-\epsilon,1+\epsilon)A
\right)
$$

For example, with:

$$
\epsilon=0.2
$$

the preferred range is roughly:

$$
0.8 \le \rho \le 1.2
$$

So PPO says:

> Make good actions more likely and bad actions less likely, but do not change their probabilities too aggressively in one update.

$$
\boxed{
\text{TRPO: control change with an explicit KL constraint}
}
$$

$$
\boxed{
\text{PPO: control change mainly through clipping}
}
$$

### 6. GRPO

GRPO stands for **Group Relative Policy Optimization**.

GRPO combines the group-based comparison idea used by RLOO with the policy-change control used by PPO.

A simplified main objective is:

$$
L_{\text{GRPO}}
=
-\frac{1}{G}
\sum_{i=1}^{G}
\frac{1}{|o_i|}
\sum_t
\min
\left(
\rho_{i,t}A_i,\;
\operatorname{clip}
(
\rho_{i,t},
1-\epsilon,
1+\epsilon
)
A_i
\right)
$$

where:

- $G$ is the number of responses generated for one prompt.
- $o_i$ is response $i$, and $|o_i|$ is its number of tokens.
- $\rho_{i,t}$ is the probability ratio between $\pi_\theta$ and $\pi_{\text{old}}$ for token $t$.
- $\epsilon$ controls the clipping range $[1-\epsilon,1+\epsilon]$.
- $A_i$ is the group-relative advantage for response $i$.

For one prompt, GRPO generates a group of responses $o_1,o_2,\dots,o_G$ and obtains their rewards $R_1,R_2,\dots,R_G$. It calculates the group mean and standard deviation:

$$
\mu_G
=
\frac{1}{G}
\sum_{i=1}^{G}R_i
$$

$$
\sigma_G
=
\sqrt{
\frac{1}{G}
\sum_{i=1}^{G}
(R_i-\mu_G)^2
}
$$

The advantage in the main objective is then:

$$
A_i
=
\frac{R_i-\mu_G}{\sigma_G}
$$

If $A_i>0$, response $o_i$ scored above the group average and should become more likely. If $A_i<0$, it scored below the group average and should become less likely. The clipped probability ratio prevents either update from changing the policy too aggressively.

Often a KL penalty to the reference model is also included.

The important difference from traditional PPO is:

$$
\boxed{
\text{PPO: usually uses a critic/value model for advantage estimation}
}
$$

$$
\boxed{
\text{GRPO: uses group-relative rewards instead}
}
$$

This removes the need for a separate critic/value model.

---

## Final Summary

Policy Gradient increases the probability of high-reward answers using $L=-R\log\pi$; REINFORCE + baseline and RLOO improve it by comparing rewards against a baseline, TRPO and PPO additionally prevent the policy from changing too much at once, and GRPO combines a group-based baseline with PPO-style clipping.
