---
title: What’s Inductive Bais in LLMs/CNNs
group: paper-summary
date: 2026-09-08
---
# What Is Inductive Bias in LLMs/CNNs?

In short, inductive bias is a built-in assumption about how to generalize.

A model never learns from scratch in a completely neutral way. Even before it sees any training data, its design already nudges it to prefer some kinds of explanations over others. In this sense, inductive bias is the set of assumptions a model makes before seeing data that guides how it generalizes from finite examples.

### CNNs -> Strong Inductive Bias

CNNs are built with architectural assumptions such as:

* Locality: Nearby pixels are more related than distant ones.
* Translation equivariance: A cat is still recognized as a cat even if it moves left or right in the image.
* Weight sharing: The same pattern detector is applied across different locations in the image.

These assumptions are hard-coded into the architecture. As a result, CNNs are biased toward learning spatially local and translation-consistent patterns, even with relatively little data. This is why CNNs generalize well on vision tasks and are relatively data-efficient, although they are less flexible outside that domain.

### LLMs (Transformers) -> Weak Inductive Bias

Transformers mainly assume that the input is a sequence of tokens and that relationships can exist between any pair of tokens. They do not strongly assume locality, hierarchical structure, grammar, or compositional syntax. Therefore, they start off much more agnostic about the structure of the data and learn language rules from data rather than having those rules built into the architecture itself.

This makes Transformers extremely flexible and capable across many domains, but also very data-hungry.
