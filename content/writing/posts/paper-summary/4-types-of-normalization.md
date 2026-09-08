---
title: 4 Types of Normalization
group: paper-summary
date: 2026-09-07
---
There are total 4 types of normalization used in ML feild. In this post, it will explain each type of normalization and when its used, plus generally why we do normalization in ml. Anyway in this post, it will cover Batch Norm, Layer Norm, Instance Norm and Group Norm

## Batch Norm
When input is (N, H, W, C) the nomalization happens to each (:, :, :, C) So in total C number of times of seperate normalization happens. Usually used in CNN, for a reference look at the image below.

### Why Do Batch Norm in CNN?
BatchNorm is used in CNNs to keep each feature channel’s activations at a more stable scale during training. For each channel, it looks at that channel’s values across the batch and all spatial locations, then normalizes them. This reduces large shifts in activation magnitude as the network updates, makes optimization more stable, and often allows faster training with larger learning rates.

![Screenshot 2026-09-08 at 8.30.14 AM.png](/writing/paper-summary/4-types-of-normalization/1788823816962-0-screenshot-2026-09-08-at-8-30-14-am.png)

## Layer Norm

Layer norm usally happens to MHA tensour outputs in transformer. When the tensor shape is (N, L, D), the normlaization is performed to each (:, :, D) so in total N*L times of seperate normalization happens here.

![Screenshot 2026-09-08 at 8.32.18 AM.png](/writing/paper-summary/4-types-of-normalization/1788823939659-0-screenshot-2026-09-08-at-8-32-18-am.png)

## Instance Norm

If the tensor shape is (N, H, W, C), it happens to (;, H, W, ;) So intotal N*C times of normalization happening here. Instance Norm usually happens to Style Transfer

### Quick Review of the Style Transfer
Style Transfer is a technique that combines a content of one image(ex, a San Francisco ity view) and style of another image(ex, The starry Night by Vincent can Gogh, 1889)

![Screenshot 2026-09-08 at 8.35.15 AM.png](/writing/paper-summary/4-types-of-normalization/1788824116653-0-screenshot-2026-09-08-at-8-35-15-am.png)

The process begins with a content image and a style image, which are both passed through a pre-trained VGG Encoder to extract the structural features of the content and the textural and color features of the style. These encoded features are then fed into the AdaIN (Adaptive Instance Normalization) block, which aligns the mean and variance of the content features to match those of the style features, effectively blending the style onto the content’s structure in the feature space. Finally, these modified features are passed through a Decoder that translates them back into a standard pixel image, producing the final stylized output.

![Screenshot 2026-09-08 at 8.36.11 AM.png](/writing/paper-summary/4-types-of-normalization/1788824172905-0-screenshot-2026-09-08-at-8-36-11-am.png)

So the Instacne Normalization is only being happened to the style image. 

So here are doing AdaIN(x, y) for every H*W. And we’re doing instance norm to only content image not style image. 





