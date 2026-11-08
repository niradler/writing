---
title: Training Our First Kubernetes Expert Model
description: We trained our first expert model in Kubernetes kubectl commands using a fine-tuning process on a specialized dataset. The dataset consists of structured…
publishedAt: '2025-03-24T22:23:02.280Z'
updatedAt: '2025-03-24T22:36:08.855Z'
tags:
  - k8s
  - kubernetes
  - models
  - ai
sourceUrl: 'https://blog.niradler.com/training-our-first-kubernetes-expert-model'
originalUrl: 'https://blog.niradler.com/training-our-first-kubernetes-expert-model'
sourceMarkdown: 'https://blog.niradler.com/training-our-first-kubernetes-expert-model.md'
series: Open source
seriesSlug: open-source
cover: /media/training-our-first-kubernetes-expert-model/cover.jpeg
coverAlt: Training Our First Kubernetes Expert Model
---
# Training Our First Kubernetes Expert Model

## Training the Model

We trained our first expert model in Kubernetes `kubectl` commands using a fine-tuning process on a specialized dataset. The dataset consists of structured prompt-command pairs where natural language queries are mapped to their respective `kubectl` commands. This allows the model to generalize and generate accurate `kubectl` commands for a variety of Kubernetes management tasks.

## Why Fine-Tune a Model for `kubectl`?

General-purpose AI models lack deep Kubernetes knowledge and struggle with domain-specific queries. Our goal is to fine-tune a model that can:

* Generate correct `kubectl` commands based on natural language input.
    
* Explain command syntax and usage with step-by-step reasoning.
    
* Identify potential errors and suggest fixes.
    

### Our Decision-Making Process

1. **Model Selection**: We use LLaMA 3.2-3B-Instruct, which balances efficiency and accuracy. It runs efficiently with 4-bit quantization, making it feasible for fine-tuning on consumer-grade GPUs.
    
2. **Fine-Tuning with Unsloth**: We streamline model training with LoRA adapters, reducing memory usage and improving efficiency.
    
3. **Dataset Curation**: We use multiple datasets to cover different aspects of `kubectl` usage:
    
    * **Basic Commands**: ComponentSoft/k8s-kubectl
        
    * **Advanced Scenarios**: ComponentSoft/k8s-kubectl-35k
        
    * **Chain-of-Thought (CoT) Explanations**: ComponentSoft/k8s-kubectl-cot-20k
        
    * **Instruction-based Training**: sozercan/k8s-instructions
        
    * **Troubleshooting & Debugging**: eliashasnat/k8s-qa
        
4. **Deployment with Ollama**: Ollama was selected for easy packaging and distribution, making it seamless to integrate into terminal-based applications.
    

### Training Process

1. **Dataset Collection**: We compiled a comprehensive dataset of `kubectl` commands mapped to natural language queries, covering a wide range of Kubernetes operations.
    
2. **Preprocessing**: We cleaned and structured the data to ensure consistency, removing redundant entries and normalizing formatting.
    
3. **Fine-Tuning**: We optimized the model using instruction-tuning techniques, allowing it to generate precise `kubectl` commands from user queries.
    
4. **Validation**: The trained model was rigorously tested against various Kubernetes scenarios to ensure accuracy and reliability.
    
5. **Deployment**: The final model was packaged as `niradler/k8s-operator:latest` for easy use within the KasK application.
    

## Integrating the Model into KasK

### KasK - Kubernetes Assistant Terminal App

KasK is an open-source terminal-based application designed to simplify your interaction with Kubernetes clusters. With KasK, you can ask natural language questions about your Kubernetes resources, and it will generate accurate `kubectl` commands to fetch the required details. The app also provides a JSON viewer to display and explore the command output in a structured and user-friendly way.

## Features

* **Natural Language Queries**: Ask questions like "Show all running pods" or "List services in all namespaces," and KasK will generate the appropriate `kubectl` command.
    
* **JSON Viewer**: View the output of `kubectl` commands in a tree-like structure with search and filtering capabilities.
    
* **Clipboard Integration**: Copy selected JSON values to your clipboard for easy sharing or further use.
    
* **Dark Mode Support**: Enhanced readability with dark mode styles.
    
* **Keyboard Shortcuts**: Navigate and interact with the app efficiently using intuitive key bindings.
    

<figure class="media" data-align="center">
<img src="/media/training-our-first-kubernetes-expert-model/kask.gif" alt="KasK terminal generating kubectl commands from a question" loading="lazy" decoding="async" data-align="center">
</figure>

## Usage

```bash
git clone https://github.com/niradler/kask.git
cd kask
pip install -r requirements.txt
python main.py
```

Write your query in the "Write your prompt here" text area. For example: Show all pods in the default namespace.

Click the "Prompt" button or press Enter to generate the `kubectl` command and view the output.

Use the JSON viewer to explore the output:

* Search for specific keys or values.
    
* Expand or collapse nodes.
    
* Copy selected values to your clipboard.
    

Use keyboard shortcuts for quick actions:

* `x`: Expand/Collapse all nodes.
    
* `s` or `/`: Focus on the search bar.
    
* `c`: Copy the selected value.
    
* `q`: Quit the application.
    

## Requirements

* Python 3.8 or higher
    
* Ollama server with the `niradler/k8s-operator:latest` [<mark>model</mark>](https://huggingface.co/niradler/k8s_operator):
    
    * [Download model](https://huggingface.co/niradler/k8s_operator/resolve/main/unsloth.Q4_K_M.gguf?download=true)
        
    * Use the [Modelfile](https://chatgpt.com/c/Modelfile)
        
    * `ollama create k8s-operator -f Modelfile`
        
* `kubectl` installed and configured to access your Kubernetes cluster.
    

## Features for the future:

* Limit commands (read-only) or review before execution.
    
* Compact table view.
    
* Tools integration.
    
* Chat memory.
    
* Model selector.
    
* Ollama configuration.
    
* UI/UX improvements.
    
* Submit prompt with keyboard.
    

With our first fine-tuned model powering KasK, we’re excited to continue improving Kubernetes management through AI-driven automation! 🚀
