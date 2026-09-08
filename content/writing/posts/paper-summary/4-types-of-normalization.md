---
title: 4 Types of Normalization
group: paper-summary
date: 2026-09-07
---
There are total 4 types of normalization used in ML feild. In this post, it will explain each type of normalization and when its used, plus generally why we do normalization in ml. Anyway in this post, it will cover Batch Norm, Layer Norm, Instance Norm and Group Norm

## Batch Norm
When input is (N, H, W, C) the nomalization happens to each (N, H, W) So in total C number of times of seperate normalization happens. Usually used in CNN, for a reference look at the image below.

### Why Do Batch Norm in CNN?
BatchNorm is used in CNNs to keep each feature channel’s activations at a more stable scale during training. For each channel, it looks at that channel’s values across the batch and all spatial locations, then normalizes them. This reduces large shifts in activation magnitude as the network updates, makes optimization more stable, and often allows faster training with larger learning rates.

![Screenshot 2026-09-08 at 8.30.14 AM.png](/writing/paper-summary/4-types-of-normalization/1788823816962-0-screenshot-2026-09-08-at-8-30-14-am.png)

## Layer Norm

Layer norm usally happens to MHA tensour outputs in transformer. When the tensor shape is (N, L, D), the normlaization is performed to each (:, :, D) so in total N*L times of seperate normalization happens here.

![Screenshot 2026-09-08 at 8.32.18 AM.png](/writing/paper-summary/4-types-of-normalization/1788823939659-0-screenshot-2026-09-08-at-8-32-18-am.png)

## Instance Norm

If the tensor shape is (N, H, W, C), it happens to (H, W) So intotal N*C times of normalization happening here. Instance Norm usually happens to Style Transfer

### Quick Review of the Style Transfer
Style Transfer is a technique that combines a content of one image(ex, a San Francisco ity view) and style of another image(ex, The starry Night by Vincent can Gogh, 1889)

![Screenshot 2026-09-08 at 8.35.15 AM.png](/writing/paper-summary/4-types-of-normalization/1788824116653-0-screenshot-2026-09-08-at-8-35-15-am.png)

The process begins with a content image and a style image, which are both passed through a pre-trained VGG Encoder to extract the structural features of the content and the textural and color features of the style. These encoded features are then fed into the AdaIN (Adaptive Instance Normalization) block, which aligns the mean and variance of the content features to match those of the style features, effectively blending the style onto the content’s structure in the feature space. Finally, these modified features are passed through a Decoder that translates them back into a standard pixel image, producing the final stylized output.

![Screenshot 2026-09-08 at 8.36.11 AM.png](/writing/paper-summary/4-types-of-normalization/1788824172905-0-screenshot-2026-09-08-at-8-36-11-am.png)

So the Instacne Normalization is only being happened to the style image. 

So here are doing AdaIN(x, y) for every H*W. And we’re doing instance norm to only content image not style image. 



## Group Norm

In group norm, split the channles into G Groups, and then normalize per groups, so normlaization is happening to each (C/G, H, W) and total G*N times of normalization happens. It usually happens in Masked R-CNN


### Quick Review of Masked R-CNN

![Screenshot 2026-09-08 at 9.14.09 AM.png](/writing/paper-summary/4-types-of-normalization/1788826451541-0-screenshot-2026-09-08-at-9-14-09-am.png)

Ideally, we would want to use Batch Normalization (BN) so the model can learn common features across a diverse set of images. However, since we are handling high-resolution images in object detection, memory bottlenecks force us to drop the batch size down to something as small as N=2. At this size, we are no longer getting a stable, universal average of the dataset. Instead, we just get the erratic, wildly swinging average of two random images, which completely destabilizes training. That is where Group Normalization (GN) has to take over.

Before jumping to GN, we might think about using Instance Normalization (IN). However, IN is designed to capture specific stylistic details by normalizing every single channel independently. For example, if we have 32 channels detecting a car wheel, IN squashes the “metallic rim” channel and the “dark rubber” channel flat on their own.

Imagine the “metallic rim” channel is naturally very bright (high activation) because metal is shiny. The “dark rubber” channel is naturally very dim (low activation) because tires are black. The neural network recognizes a “wheel” specifically by seeing this exact contrast: a bright circle surrounded by a dark circle. If you apply Instance Normalization, it forces every individual channel to have the exact same average brightness.

It takes the bright rim channel and forcefully dims it down to average. It takes the dark rubber channel and forcefully brightens it up to average. Now, both channels have the exact same flat intensity. The contrast between them is completely erased. Because that bright-to-dark relationship is destroyed, the network loses the structural context it needs to recognize the object as a wheel.

This destroys the relative differences in activation strength between those channels, wiping out the combined information the network needs to recognize the wheel.

GN solves this by taking those G related channels, putting them into one group, and calculating a single mean and variance for that entire group. By scaling the whole group together, GN preserves the relative differences between the channels. If the “metallic rim” channel is firing twice as hard as the “rubber” channel, GN scales them both simultaneously, keeping that crucial 2:1 ratio intact.









