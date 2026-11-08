---
title: 'Post-Training: When a Specialist Beats a Bigger Model'
description: 'I’ve been experimenting with post-training lately, and I think it will become a much more common part of building AI products. A software engineer, an SRE…'
publishedAt: '2026-11-04T23:06:03.454Z'
updatedAt: '2026-11-04T23:15:32.281Z'
tags: []
sourceUrl: 'https://blog.niradler.com/post-training-when-a-specialist-beats-a-bigger-model'
originalUrl: 'https://blog.niradler.com/post-training-when-a-specialist-beats-a-bigger-model'
sourceMarkdown: 'https://blog.niradler.com/post-training-when-a-specialist-beats-a-bigger-model.md'
cover: /media/post-training-when-a-specialist-beats-a-bigger-model/cover.jpg
coverAlt: 'Post-Training: When a Specialist Beats a Bigger Model'
---
# Post-Training: When a Specialist Beats a Bigger Model

I’ve been experimenting with post-training lately, and I think it will become a much more common part of building AI products.

A software engineer, an SRE, and a financial compliance officer each know what good work looks like in their field. They can spot mistakes that a fluent, confident answer might hide. Post-training gives teams a way to turn that judgment into learned model behavior.

The opportunity is compelling: take an existing model and train it to perform the work your product needs, potentially with better results and lower serving costs.

## What is post-training?

Post-training is additional training that shapes an existing model’s capabilities and behavior. Instead of building a model from scratch, you start with one that already has broad abilities and teach it through examples, preferences, or rewards.

A prompt gives the model instructions for an interaction. Retrieval gives it information to work with. Post-training changes its learned parameters—or trains an adapter applied alongside them—so the behavior can carry across interactions.

These approaches work together. A specialist model may still need a good prompt, current documents, and reliable tools.

## Common methods

**Supervised fine-tuning (SFT): learn from examples.**\
Train on tasks paired with good responses. For a coding assistant, a demonstration might include inspecting a repository, making an edit, and verifying the result. The model learns to produce responses like those demonstrations. [SFT documentation](https://huggingface.co/docs/trl/sft_trainer).

**Direct Preference Optimization (DPO): learn from comparisons.**\
Provide a preferred and rejected response to the same task. For example, an expert might favor an investigation supported by logs over a confident diagnosis without evidence. Training encourages the model to favor the preferred response. [DPO paper](https://arxiv.org/abs/2305.18290).

**Reinforcement learning (RL): learn from attempts and feedback.**\
Let the model attempt tasks, score the results, and train it toward better outcomes. Feedback can come from tests, simulations, or a reward model. The difficult part is defining a reward that reflects useful work: passing a test or guessing the right diagnosis is not always enough. Datadog’s Scout, for example, is rewarded for both identifying a cause and supporting it with evidence. [Scout’s training approach](https://www.datadoghq.com/blog/ai/introducing-scout-sre-specialized-model-bits-ai/).

**LoRA makes adaptation more affordable.**\
LoRA is a way to train parameter updates, rather than a separate learning objective. It freezes the base model and trains small additional matrices, reducing the number of trainable parameters. It can be combined with methods such as SFT and preference training. [LoRA paper](https://arxiv.org/abs/2106.09685).

## Where it is already working

**Cursor: training for real software engineering.**\
Composer 2 starts from Kimi K2.5, adds code-focused continued pretraining, then uses reinforcement learning in environments resembling actual Cursor sessions. Cursor reports a 37% improvement over Composer 1.5 on its internal CursorBench evaluation, alongside lower inference costs than comparable models. The model is deployed in its product, connecting training directly to the work customers do. [Cursor’s technical report](https://cursor.com/blog/composer-2-technical-report).

**Aveni: specialization for financial services.**\
Aveni combines continued pretraining with supervised fine-tuning on finance-specific material and tasks. It says its FinLLM family powers its products, with specialist models already in production reviewing conversations for compliance findings. This is a practical use for domain expertise: teaching a model to recognize distinctions that financial-services professionals care about. [Training approach](https://aveni.ai/resources/aligning-llms-to-financial-services-the-technical-procedures-behind-avenis-finllm/) and [production use](https://aveni.ai/intelligence/finllm/).

**Datadog: an early deployment for incident investigation.**\
Scout is post-trained to investigate production issues using tools and telemetry. Datadog reports comparable performance to selected frontier models on its target evaluation at an estimated 3–8 times lower inference cost. Internal teams and a small customer group are using it on production alerts through a closed preview. That makes it an encouraging early deployment, with broader adoption still ahead. [Datadog’s announcement](https://www.datadoghq.com/blog/ai/introducing-scout-sre-specialized-model-bits-ai/).

These are company-reported results on particular workloads. They show that specialization can support real products; they do not establish that a customized model will outperform general models everywhere.

## The operational challenges are still real

A successful training run is only part of the job.

**Base models keep improving.** A new release can change the economics of your specialist model. Teams face a recurring decision: keep the existing model, move to a stronger base, or repeat adaptation and evaluation. Training data and evaluations may remain useful, but migration still takes work.

**Serving multiple specialists adds complexity.** Different models and adapters need memory, loading, routing, batching, and version management. A model that is cheap per token can still be expensive to operate if it spends much of its time idle.

**Caching becomes more complicated too.** Keeping models or adapters ready in memory is one problem; reusing previously computed prompt state is another. Changing model weights generally prevents direct reuse of that state, and adapter identity must be accounted for. Serving systems already offer building blocks such as multiple LoRA adapters and prefix caching, but operating them efficiently across many specialists still requires engineering. [vLLM adapter support](https://docs.vllm.ai/en/latest/features/lora/) and [prefix caching](https://docs.vllm.ai/en/latest/features/automatic_prefix_caching/).

**Quality needs ongoing evaluation.** A model can learn poor demonstrations, exploit an incomplete reward, or improve a narrow task while losing another useful capability. The meaningful comparison is against a strong baseline on unseen work, including the total cost of training, serving, and maintenance.

## Why I’m optimistic

I think this process will become much easier.

My expectation is that better tooling will simplify training, evaluation, model upgrades, and deployment. I also expect caching, adapter loading, and inference scheduling to become easier to manage, making it more practical to serve many specialized models.

That will make post-training accessible to more teams. The technical machinery will become less of a barrier, while domain expertise will remain valuable: knowing which examples to teach, which outcomes to reward, and which failures matter.

My bet is that post-training will become a routine part of building AI products—especially where teams understand a recurring task well enough to teach it and measure whether the model has improved.
