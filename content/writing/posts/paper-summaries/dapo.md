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
