---
title: Kaggle Playground Series — General Strategy Playbook
group: kaggle-playground-series
date: 2026-09-03
---
A reusable approach for any monthly Playground competition (tabular, classification
or regression). Built from the patterns the consistent top finishers use. The
specifics change month to month; the **structure** below does not.

---

## 0. The mental model that drives everything

Playground `train.csv` is **synthetic data generated from a real `original.csv`.**
That means every month your models learn from **two signal sources**:

1. **Artifact signal** — patterns the synthetic generator bakes in. Extracted the same
well-known ways every month (target-encode numerics, group-by-target means from the
original, digit/decimal extraction, etc.). Basically *solved* — read past solutions.
2. **Real signal** — the structure of the underlying `original.csv`. This is what
actually varies month to month and decides the competition.

**First diagnostic every month:** train a model on `original.csv` alone.
- If it needs only `max_depth=1` / a linear fit → the real signal is trivial; the
competition is mostly artifact extraction (solvable fast).
- If it needs `max_depth=6–8` → there’s **real, non-trivial signal**; genuine feature
engineering and diverse architectures will pay off. Invest accordingly.

The winning meta-strategy is the same regardless: **build a large, diverse pool of
out-of-fold (OOF) predictions and stack them.** Diversity beats per-model perfection.

---

## 1. Setup & validation (do this first, once)

- **Fix one CV scheme and freeze it.** Usually `StratifiedKFold(5, shuffle, seed=42)`
(stratify on target; for grouped data use `GroupKFold` / `StratifiedGroupKFold`;
for time use a time-aware split). Save the exact `id → fold` map to disk. **Every
model must use these identical folds** or the OOFs can’t be stacked.
- **Adversarial validation** — train a classifier to separate train vs test (and train
vs original). High AUC = distribution shift. The features that separate them most are
your “handle with care” features: consider dropping/down-weighting them in some models
(a major source of both robustness and diversity — see §6).
- **Match the metric.** Optimize and threshold to the *actual* eval metric (AUC,
balanced accuracy, RMSE, logloss, etc.), not accuracy by default. Apply class /
sample weighting when the metric is imbalance-aware.
- **Build a feature store once**, then draw subsets. 200–800 candidate features is
normal; different models read different subsets (itself a diversity lever).

---

## 2. Feature engineering — the full menu

Build these into a single feature-engineering pass, then slice into 2–3 frozen feature
sets (e.g. *full / medium / lean*). **Target encoding is applied per-fold inside the
model loop, never on full train** (leakage).

### A. Original-data / artifact features (Playground-specific, high value)
- **Original-as-columns (target stats):** `original.groupby(COL)[TARGET].agg(mean/std/count)`
merged onto train/test. For classification, per-class rates (one column per class).
Smooth small groups toward the global prior.
- **Original-as-rows:** concatenate original into training (optionally with a
`is_original` flag and/or a sample weight 0.25–1.0 to modulate its influence).
- Only group on columns that **exist in both** train and original.
- **Clean the original first** — Playground originals often carry sentinel values
(`-9999`, `-1`), duplicate rows, or extra ID columns absent from train. Drop/clean
before computing any statistic.

### B. Numeric transforms (per column)
- `log1p`, `sqrt`, `square`, reciprocal, Box-Cox / Yeo-Johnson
- Rank / quantile transform, standardize, clip outliers
- `is_zero`, `is_negative`, `is_missing`, sentinel flags
- **Keep raw-NaN + imputed copies together when useful.** Do not always overwrite the
original column when imputing. Keep the original NaN-containing feature and add a second
imputed copy (median / mean / other appropriate fill). This lets NaN-aware tree models use
missingness directly while also giving them a complete numeric version of the same signal.
- Rounding to k decimals; **digit / decimal extraction**. Make this concrete: extract the
fractional part, first decimal digit, second decimal digit, and selected rounded versions.
Playground generators can leave **decimal-lattice** artifacts — repeated numeric-grid or
rounding patterns — so the decimal digits themselves can carry signal. Test each candidate;
first-decimal-digit features may help while deeper digit interactions can be noise.
- Binning: quantile bins (`qcut`) and fixed-width bins → as ordinal *and* as category

### C. Numeric interactions (pairwise / triple)
- Differences, ratios, products, sums for column pairs
- 3-way arithmetic combos for a few promising triples
- Polynomial features on a small selected set
- Ratios to a group aggregate (value ÷ group-mean)

### D. Categorical encoding
- **Target encoding** (per-fold, leak-free; multiclass → one column per class).
A strong practical configuration is **10-fold inner TE**: inside each outer model-training
fold, split the training portion into 10 inner folds and create each row's TE from the other
9 folds. The main OOF/model CV can still remain 5-fold — the 10 folds are only for building
leak-free TE features.
- **Frequency / count encoding** (global counts per category). It can be generated alongside
TE in the same inner-fold pipeline when you want the exact same leakage discipline.
- **Label / ordinal** for tree models
- **One-hot** for low-cardinality (and for linear / NN models)
- **CatBoost-native categorical configuration.** For at least one CatBoost setup, keep
categorical columns as categorical and pass them through `cat_features` / a CatBoost `Pool`
instead of converting every category into an ordinary numeric column first. This lets CatBoost
use its own ordered categorical statistics. Keep a separately encoded CatBoost configuration
when useful; the two can contribute different OOF errors.
- **Leave low-cardinality cats raw** where the model supports native categorical handling;
for models that do not, use an appropriate encoding rather than arbitrary integer semantics.
- **n-gram / nested target encoding** on category *combinations*

### E. Categorical interactions
- **Cat × cat crosses** — concatenate keys, label-encode (all pairwise, or selected)
- **”Category twins” of numerics** — bin or floor a numeric into a pseudo-category, then
cross it with real categories or with other binned numerics
- Group-by features: one column as the grouper, another (high-cardinality) as the
aggregated value → mean/std/nunique/min/max within group

### F. Domain features (problem-specific — where real edges hide)
Read the data dictionary and encode the actual domain. Examples by domain:
- **Astronomy (mags/colors):** color indices (differences of bands), redshift
transforms, sky-position sin/cos, magnitude aggregates
- **Geospatial:** distances to landmarks, lat/lon → grid cells, haversine between points,
density in radius
- **Datetime:** cyclical encode (sin/cos of hour/day/month), is_weekend/holiday, deltas
since/until events, rolling windows
- **Sports / sequential:** per-entity history aggregates split by **past vs current vs
future** windows (mind leakage — “all years” stats can leak the target; keep separate
leaky and non-leaky versions and let CV decide)
- **Money / counts:** log scale, per-capita ratios, share-of-total
- **Text-ish IDs:** length, character/digit composition, prefix/suffix buckets

### G. Aggregate / grouping features
- Group statistics (mean/std/min/max/count/nunique) by each categorical key
- Value minus its group mean; value’s rank within group
- Cross-aggregations (grouper A × aggregator B)

### H. Cyclical & positional
- `sin/cos` for any angular or periodic quantity (time, sky coords, compass)
- Positional/index features only when row order is meaningful (check first)

### I. Dimensionality / representation (optional diversity)
- PCA / SVD / UMAP components as extra features
- Cluster ID (KMeans) and distance-to-centroid
- Target-encoded leaf indices from a small tree model
- Denoising-autoencoder embeddings (advanced; good NN diversity)

> Build a **superset**, then freeze 2–3 named subsets. Different models on different
> subsets is one of the cheapest diversity wins.

---

## 3. Models — the diversity roster

Run **many families**, not many copies of one. Strong + weak both belong (weak adds
decorrelated errors). The reliable core and the diversity tail:

**Core (most of the pool):**
- **GBDTs:** XGBoost, LightGBM, CatBoost — most reliable, stable across params. Run
classifier *and* regressor framings.
- **Tabular NNs:** RealMLP, TabM, TabICL — strong, genuinely different error profiles.

**Diversity tail (1–few each — present for decorrelation, not accuracy):**
- HistGradientBoosting, ExtraTrees, RandomForest
- FT-Transformer, MLP-PLR, SAINT, TabR, TabNet, NODE, AutoInt, GANDALF, ModernNCA
- Linear / Logistic (with logits), KNN, GNN, FFM/FM, YDF
- **AutoML** as a model and/or ensembler: AutoGluon, FLAML, LightAutoML, PyTabKit

---

## 4. No Optuna (at scale)

Per-model HPO barely moves the final score **once the ensemble is large and diverse.**
- Start from known-good params (old solutions, public notebooks) and **tinker a few**
important ones (depth, colsample, learning rate, leaves).
- **Multiple HP variants of the same family/features is itself diversity** — keep
shallow *and* deep tree variants, etc. Don’t converge them all to one “optimum.”
- HPO **does** matter if you commit to a *small* pool (≤10–20 models) or a solo model —
then near-optimal params are crucial.
- Quick light tuning (FLAML, 1–2 folds, subsample) is fine for a promising new setup;
full Optuna is usually not worth it.

---

## 5. How to actually generate ~150–250 OOFs

The pool is a **product of axes**, generated as a campaign, not hand-made one by one:

```
[feature sets] × [model families] × [hyperparameter shapes] × [data treatments]
```

- Each combination = one config = one OOF (+ matching test prediction).
- **Seeds are NOT a diversity axis** — averaging seeds denoises one config; it doesn’t
count as a new model. Diversify via features / HP / architecture / data treatment.
- A config “counts as diverse” only if it’s *meaningfully* different — a new
architecture, a radically different feature set (think +100 features, not +1), a
different data treatment — **not** one feature swapped or one seed changed.
- Keep a **scoreboard file** (a local leaderboard: key, CV score, n_features, time).
This is exactly how top finishers (and LLM-agent runs) stay organized at scale.
- **Naming convention:** `oof_{model}__{featureset}__{tag}.npy` + `test_{…}.npy` in
one folder. The final stacker **globs the folder** and ingests whatever exists — it
never needs a hardcoded model list, so you can keep adding OOFs to the end.

---

## 6. Distribution-shift handling (a repeatable edge)

When adversarial validation flags shift between train/test or train/original:
- Build **”feature-dropped” variants** that omit the most-shifted feature(s) — these
often score better *and* add diversity.
- **Modulate the original’s influence** via sample weights (0.5–1.0 usually safe; very
low like 0.25 tends to hurt CV/LB).
- Keep both **with-original** and **without-original** model variants in the pool.

---

## 7. Ensembling — collapse the pool

1. **Logit-stack** (the dominant choice): convert OOF probabilities → logits, fit a
linear meta-learner (Logistic / Ridge) on them. Class-balanced when the metric is.
2. **Alternatives worth blending in:** AutoGluon stacker, Hill Climbing, simple LR.
*A blend of two strong ensemblers often beats either one* (e.g. 50/50 AutoGluon +
LR-logits).
3. **Optional L2 stacking** — fit a model on level-1 OOFs. Carries leakage risk, so
level-1 preds must come from **nested CV**. Keep one submission that avoids L2 as a
hedge.
4. **Post-processing** to the metric: per-class weight optimization (differential
evolution) for balanced accuracy; threshold tuning for F1; rank-averaging for AUC.

---

## 8. Leakage discipline (non-negotiable)

- Target encoding fit on **train-fold only**, applied to val/test (per-fold).
- Group/time aggregates must respect the split (no future/peer leakage).
- **Nested folds for any L2** so meta-features are leak-free.
- Same `id → fold` map across **every** OOF in the pool.
- Be suspicious of any single feature that spikes CV — verify it isn’t leaking.

---

## 9. Submission selection (the last 1%)

- Margins at the top are tiny — **trust your CV**, avoid heavy public-LB probing.
- Submit a **2-slot portfolio:** one **conservative** (stack only, lower variance) and
one **aggressive** (stack + post-processing, higher ceiling).
- Don’t over-correct on the last day — people lose places by switching off a good
aggressive sub for a “safe” one (and vice versa). Pick on CV, commit.

---

## 10. Workflow / tooling

- **Split notebooks by environment + library**, not by tidiness: GBDTs together
(stable stack); each finicky NN library its own notebook (version pins); CPU/sklearn
models together; one “grab-bag” for one-off diversity models.
- **A shared common module** (`common.py`) imported by all model notebooks holds the
fold loading, per-fold TE, scoring, and OOF-saving — so every OOF is consistent and
each notebook stays tiny.
- **Big GPU?** GBDTs won’t fill it (1–4 GB is normal — that’s fine). Saturate it in the
**NN notebooks** instead: large batches, bf16 mixed precision, data on-GPU.
- **LLM agents** (Codex / Claude Code) can run the OOF-generation campaign
semi-autonomously — give them the data brief, a frozen CV, a local leaderboard file to
maintain, and let them iterate. Human stays the layer for leakage checks and final
submission choice.

---

## TL;DR checklist

- [ ] Freeze a CV scheme; save `id → fold`
- [ ] Adversarial validation (train↔test, train↔original)
- [ ] Diagnose original signal depth (max_depth needed)
- [ ] Build a feature superset (all of §2), freeze 2–3 subsets
- [ ] Keep raw-NaN + imputed copies for promising missing-value features
- [ ] Test explicit decimal-lattice features (fractional part / first decimal digit / rounding)
- [ ] Per-fold leak-free target encoding; test 10-fold inner TE inside the outer model fold
- [ ] Keep at least one CatBoost-native categorical setup using `cat_features`
- [ ] Generate OOFs as a product of axes (target 150–250)
- [ ] Keep a scoreboard; consistent OOF naming in one folder
- [ ] With/without shifted-feature variants for diversity
- [ ] Logit-stack + alternative ensembler; blend them
- [ ] Metric-aware post-processing
- [ ] 2-slot submission (conservative + aggressive), pick on CV
