---
title: A Brief History of Kubernetes Fleet Controllers & Essential Features
description: Managing a handful of Kubernetes clusters is difficult but manageable. Managing hundreds or thousands of clusters is a fundamentally different problem. At…
publishedAt: '2026-02-07T14:47:24.174Z'
updatedAt: '2026-02-08T10:56:11.347Z'
tags:
  - kubernetes
  - containers
  - fleet-management
sourceUrl: 'https://blog.niradler.com/a-brief-history-of-kubernetes-fleet-controllers-and-essential-features'
originalUrl: 'https://blog.niradler.com/a-brief-history-of-kubernetes-fleet-controllers-and-essential-features'
sourceMarkdown: 'https://blog.niradler.com/a-brief-history-of-kubernetes-fleet-controllers-and-essential-features.md'
cover: /media/a-brief-history-of-kubernetes-fleet-controllers-and-essential-features/cover.jpeg
coverAlt: A Brief History of Kubernetes Fleet Controllers & Essential Features
---
# A Brief History of Kubernetes Fleet Controllers & Essential Features

## Building Scalable Multi-Cluster Systems with Reusable Components

Managing a handful of Kubernetes clusters is difficult but manageable. Managing hundreds or thousands of clusters is a **fundamentally different problem**. At that scale, Kubernetes stops being "infrastructure you run" and becomes a **system you must design**.

This article is a companion to my **ContainerDays** talk. It walks through why Kubernetes fleets are inevitable, where most teams go wrong, how fleet controllers emerged, and how to evaluate and choose the right tools using a practical framework. We'll do a fast-paced review of five open-source tools - **Clusternet**, **Karmada**, **Crossplane**, **Cluster API**, and **Rancher** - and show how each addresses different multi-cluster management challenges.

---

## From Clusters to Fleets: How We Got Here

Nobody sets out to build a Kubernetes fleet. Teams usually start with one cluster, one environment, and a small number of services. Then reality arrives: more regions, more environments, more teams, sometimes per-tenant clusters. Infrastructure costs drop. Automation improves. Kubernetes makes scale accessible.

Nothing breaks. And yet everything changes.

At some point, adding "just one more cluster" doesn't feel free anymore. Coordination overhead grows. Consistency erodes. Visibility fragments. Operational toil creeps in. This isn't a Kubernetes problem - it's a systems problem.

---

## Why Fleet Problems Are Predictable

The key insight is simple: **infrastructure scales linearly, but complexity does not**. Every new cluster adds policies, permissions, upgrades, observability pipelines, and human coordination. This is why fleets appear suddenly and feel overwhelming. Teams didn't fail - they **reached the next stage of maturity**.

---

## Why This Feels Familiar to Developers

If you've ever worked on a large codebase, this story should sound familiar. **Kubernetes fleets fail for the same reasons software systems fail**.

Think of it this way:
- **Clusters** behave like services
- **YAML** becomes an untyped API
- **Helm charts** act like shared libraries
- **Configuration drift** looks exactly like forked code
- **Snowflake clusters** are just technical debt by another name

The core failure mode is always the same: **too much reuse, too late, without abstraction**. Teams copy YAML. They templatize configurations. They standardize Helm charts. And then every cluster needs "just one exception." Standardization slows divergence - it doesn't prevent it.

---

## The Shift: From DevOps to Platform Engineering

At fleet scale, **infrastructure is no longer a task - it's a product**. This is where many organizations shift from **DevOps as operators** to **platform engineering as enablers**. The goal changes from "manage clusters" to "enable teams through self-service, automation, and clear abstractions."

When you're running clusters at a 100:1 ratio, you can't afford to have engineers manually configuring each one. Standardization, observability, security, and access control become pressing issues that demand automation. **Fleet controllers emerge as a direct response to this shift**.

---

## Understanding Controllers in Kubernetes

Before diving into fleet controllers, let's understand what a **controller** is in Kubernetes. A controller is a **control loop** that watches the state of your cluster through the API server and makes changes to move the current state toward the desired state.

Controllers work with **Custom Resource Definitions (CRDs)** to extend Kubernetes capabilities. For example, imagine you want to manage a fleet of speakers at a conference. You could define a CRD for `Speaker` resources:

```yaml
apiVersion: conference.example.com/v1
kind: Speaker
metadata:
  name: john-doe
spec:
  topic: "Kubernetes Fleet Management"
  duration: 45
  room: "main-hall"
  requiredEquipment:
    - microphone
    - projector
status:
  assigned: false
  equipmentReady: false
```

A speaker controller would continuously watch for `Speaker` resources and ensure the actual state matches the desired state. When a new `Speaker` is created, the controller might:

1. Check room availability and assign the speaker
    
2. Verify required equipment is available
    
3. Send calendar invites to attendees
    
4. Update the status to reflect current state
    
5. Handle conflicts or resource constraints
    

If the speaker's room changes, the controller detects the difference between desired state (`spec`) and current state (`status`), then takes action to reconcile them. This same pattern applies at fleet scale - **fleet controllers watch cluster resources and continuously reconcile state across hundreds or thousands of clusters**.

---

## What Is a Fleet Controller (Really)?

A fleet controller follows the exact same control-loop model as a standard Kubernetes controller - it just **operates across clusters** instead of inside a single cluster.

If a regular controller watches resources within one cluster and reconciles their state, a **fleet controller watches many clusters and reconciles their collective state** against a desired configuration.

Think of it as moving up one level:

**Controller:**
“Given this desired state, make this cluster match it.”

**Fleet controller:**
“Given this desired state, make all these clusters match it.”

Instead of reconciling Pods, Services, or custom resources, a fleet controller reconciles things like:

- Which clusters exist and are healthy

- Which workloads should run on which clusters

- Which policies apply globally vs regionally

- How upgrades, failures, and drift are handled across the fleet

From an implementation perspective, a fleet controller is **not magic** and **not a single product**. It is a higher-level control plane built from familiar Kubernetes primitives: APIs, CRDs, controllers, and reconciliation loops - just applied at fleet scale.

Common responsibilities include:

- Cluster registration and inventory

- Declarative propagation of workloads and policies

- Lifecycle automation (create, upgrade, decommission clusters)

- Observability, governance, and drift detection

- High availability and failover across clusters

These are not “advanced” features.
**Once you operate more than a handful of clusters, they become survival features**.

---

## The Big Mistake: Treating Tools as Competitors

One of the most common mistakes teams make is asking **"which fleet management tool should we choose?"** This is the **wrong question**. Fleet management is layered, and different tools solve different layers of the problem.

However, this doesn't mean you should adopt every tool that exists. There's a balance between **composition** and **consolidation**. Adding a new tool to your stack should be justified by real pain points and clear value. More importantly, your tools must **work in synergy with each other** - not in conflict.

Before adopting a new tool, ask: **does this solve a problem we actually have?** Does it integrate well with our existing stack? Are we introducing unnecessary complexity? The goal is a composed platform where each tool has a clear purpose and they work together cohesively, not a fragmented collection of competing solutions.

---

## The Three Layers of Fleet Management

### Layer 1: Infrastructure - Cluster Lifecycle

This layer answers **how clusters are created, upgraded, and how consistency is enforced**.

**Cluster API** gives you declarative, repeatable cluster lifecycle management. Instead of scripts and manual processes, clusters become versioned resources. Features like `ClusterClass` let organizations define reusable cluster templates - the same way you'd define a base class in software. Other teams rely on managed Kubernetes offerings combined with automation and policy tooling. The key shift is that **clusters stop being snowflakes and start being managed resources** with lifecycle, ownership, and consistency built in.

### Layer 2: Platform - Abstraction and Reuse

This is where most teams struggle - and where the **biggest wins exist**. This layer answers **how teams consume infrastructure, how complexity is hidden, and how intent is expressed**.

**Crossplane** lets you expose infrastructure and services as Kubernetes APIs, using compositions to define reusable intent. **kro** helps teams define Kubernetes-native abstractions for applications and environments. Many organizations also build lighter-weight internal platforms using CRDs, controllers, and policy engines like **Kyverno** or **OPA**. What matters is that **teams consume intent - not raw YAML**.

### Layer 3: Application - Delivery and Distribution

This layer answers **how workloads are packaged, deployed across clusters, and how changes are rolled out safely**. Tools like **Helm**, **Kustomize**, **Argo CD**, and **Flux** are commonly used here. GitOps works extremely well at this layer, but it's important to be honest: **GitOps delivers workloads - it does not define infrastructure abstractions or solve fleet architecture**.

---

## Five Open-Source Fleet Tools: A Practical Review

Let's look at five tools that address multi-cluster management from different angles. Each has unique strengths in provisioning, management, and application support.

### Clusternet

**Clusternet** is a lightweight, Kubernetes-native multi-cluster management platform. It focuses on managing clusters as a fleet by providing a hub-agent architecture where child clusters register with a parent hub. Its strength is **workload distribution** - you can define scheduling policies to deploy applications across clusters based on labels, regions, or custom rules. Clusternet treats multi-cluster workload orchestration as a first-class concern and is a good fit for teams that need to distribute applications across many clusters without heavy infrastructure investment.

### Karmada

**Karmada** (Kubernetes Armada) is built specifically for multi-cloud and multi-cluster orchestration. It extends Kubernetes APIs to work across clusters, so you can use familiar resources like Deployments and Services while Karmada handles the propagation and scheduling across your fleet. Its `PropagationPolicy` and `OverridePolicy` resources give fine-grained control over where and how workloads land. Karmada shines when you need **cross-cluster failover, replica scheduling, and policy-based distribution at scale**. It's one of the most feature-complete open-source options for fleet-wide workload management.

### Crossplane

**Crossplane** takes a fundamentally different approach. Rather than managing clusters directly, it **turns infrastructure into Kubernetes APIs** through Compositions and Claims. Teams define what they need using custom resources, and Crossplane provisions the underlying infrastructure - cloud resources, databases, clusters, anything with a provider. At the fleet level, Crossplane is invaluable as a platform layer tool: it enables **self-service infrastructure consumption** and enforces organizational standards through compositions. It doesn't orchestrate workloads across clusters, but it's the **best open-source option for building platform abstractions**.

### Cluster API

**Cluster API** (CAPI) focuses squarely on the **lifecycle of Kubernetes clusters themselves**. It lets you declaratively create, configure, upgrade, and destroy clusters using the Kubernetes API. With `ClusterClass`, you can define reusable cluster templates - think of it as **inheritance for your infrastructure**. This means new clusters are consistent by default, upgrades are version-controlled, and provisioning is repeatable across clouds. Cluster API is the **go-to tool at the infrastructure layer** when you need to manage cluster lifecycle at scale.

### Rancher

**Rancher** by SUSE is the **most complete platform in this list** - it provides a full management plane for Kubernetes clusters across any infrastructure. It handles cluster provisioning, centralized authentication, monitoring, policy enforcement, and application catalog management through a single UI and API. Rancher is often the **first fleet management tool organizations adopt** because it offers immediate visibility and control. Its strength is **breadth**: it covers lifecycle, observability, security, and app delivery in one package, making it a pragmatic starting point for teams that need results quickly.

### How These Tools Map to the Three Layers

No single tool covers all three layers perfectly. Here's where each tool provides the most value:

**Infrastructure Layer (Lifecycle):** **Cluster API** and **Rancher** are strongest here. CAPI for declarative lifecycle-as-code, Rancher for centralized management with a UI.

**Platform Layer (Abstraction):** **Crossplane** dominates this space. It's purpose-built for turning infrastructure into consumable APIs.

**Application Layer (Distribution):** **Karmada** and **Clusternet** focus on workload propagation and scheduling across clusters. Rancher also provides app catalog and deployment capabilities.

The practical takeaway: **compose these tools based on your organizational needs rather than picking one and forcing it to do everything**.

---

## Compose, Don't Consolidate

There is no single tool that solves fleet management end-to-end. **Successful platforms are composed, layered, and intentional**. Cluster lifecycle tools don't replace GitOps. Platform abstractions don't replace delivery pipelines. Some teams lean more heavily on managed services. Some invest deeply in platform tooling. Some do both. What successful teams have in common is that **they align tools to layers instead of forcing one tool to do everything**.

---

## Reusable Components Are the Unit of Scale

This is the most important idea in fleet management: **clusters are not the unit of scale - reusable components are**. Cluster templates, platform APIs, application abstractions, and policy bundles are what allow organizations to grow without growing operational load. **Clusters are execution environments. Components encode intent**.

---

## The Interface for Successful Fleet Management

There's a concept from the development world that applies directly to fleet management but is often overlooked: the **developer portal**. While fleet controllers manage the technical orchestration, teams still need a unified interface to discover, understand, and interact with their distributed infrastructure.

A developer portal should orchestrate all the operational context: **documentation, service inventory, metrics dashboards, deployment URLs, regional endpoints, team ownership, dependencies, and SLOs**. It's the **human interface to your fleet** - a single place where engineers can answer questions like "where is this service running?", "who owns this cluster?", "what's the health of services in us-west?", or "how do I deploy to production?"

These concepts are not new. Tools like **Backstage**, **Port**, and others have made developer portals mainstream in software engineering. However, they're not always treated as native components in Kubernetes fleet management - and they should be. A well-designed platform includes not just the **control plane** (fleet controllers, GitOps, policy engines) but also the **developer plane** (portals, service catalogs, observability interfaces).

Without this layer, you end up with infrastructure that works but nobody knows how to use it. Engineers waste time searching for information, duplicating work, or making changes blindly. A developer portal **bridges the gap between powerful infrastructure and productive teams** by making the fleet discoverable, understandable, and accessible.

---

## A Framework for Evaluating Fleet Tools

When choosing tools for your fleet, evaluate against these dimensions:

**Provisioning:** Does the tool help you create and destroy clusters declaratively? Can you template and version cluster configurations?

**Management:** Does it provide centralized inventory, health monitoring, and policy enforcement? Can you manage upgrades across the fleet?

**Application Support:** Does it handle workload distribution, scheduling policies, and multi-cluster deployment? Does it integrate with your existing CI/CD and GitOps workflows?

**Abstraction Quality:** Does it let you hide complexity without hiding capability? Can teams consume infrastructure through clean APIs rather than raw YAML?

**Composability:** Does it play well with other tools in your stack, or does it demand to be the single pane of glass?

Use these questions as a replicable framework to evaluate tools based on your specific organizational needs rather than feature comparisons.

---

## Principles for Success

Across organizations, the same principles apply:

- **Start with Standards.** Define clear conventions for clusters, networking, security, and observability before adopting tools.
- **Layer Properly.** Separate lifecycle, abstraction, and delivery concerns. Don't conflate them.
- **Abstract Progressively.** Hide complexity, not capability. Bad abstractions are worse than none.
- **Compose Solutions.** Align tools to problems instead of chasing a silver bullet.
- **Measure Impact.** Track reduced toil, faster onboarding, and fewer incidents - not just tool adoption.

---

## Where to Start (Practically)

There is no universal starting point. Ask instead: **where is the pain? Where is the toil? What breaks most often?**

If provisioning and upgrades are painful, focus on **lifecycle automation** with Cluster API or Rancher. If teams struggle with consistency, invest in **platform abstractions** with Crossplane. If workload distribution is complex, evaluate **Karmada** or **Clusternet**. If delivery is slow or risky, improve your **GitOps workflows**.

The reality is that most large companies end up building **custom solutions** - custom CRDs and controllers tailored to their specific workflows and constraints. This is reasonable and often necessary at scale when off-the-shelf tools can't fully capture your domain logic.

For smaller organizations or those just starting their fleet journey, my recommendation is different: **start by composing a solution from existing tools**. Extend and adapt them to fit your needs. Only move to fully custom solutions when it becomes a must - when the complexity or constraints of existing tools outweigh the cost of maintaining your own controllers.

Custom solutions give you ultimate flexibility, but they also come with **maintenance burden, technical debt, and the need for deep Kubernetes expertise**. Compose first, customize progressively, and build fully custom only when justified by clear requirements that cannot be met otherwise.

Pick one problem, solve it well, and build reusable components around it. **Start small. Document it well. Expand intentionally**.

---

## The Next Step: Autonomous Operations

Today, my daily work focuses on building **AI-driven SRE systems**. The goal is simple: **engineers become the bosses, not the on-call responders**.

We're building **autonomous AI SRE agents** that monitor systems in real time, understand incidents as they happen, and actively heal issues before you even wake up. Imagine starting your morning with an incident report waiting for you - including a **pull request that fixes the root cause**, clear explanations of what happened, and concrete recommendations to prevent similar issues in the future.

That future only works if infrastructure is well-designed. If fleets are observable. If abstractions are clear. And if systems are built to be reasoned about - **by humans and machines**.

Fleet management, platform engineering, and reusable components are not just about scale - they are the **foundation for autonomous operations**.

---

## Final Thoughts

**Fleets are inevitable. Chaos is not.**

By applying software architecture principles to infrastructure - **abstraction, reuse, composition** - and by choosing the right tools for the right layers, teams can scale Kubernetes without losing control. The five tools we covered each solve a genuine piece of the puzzle, and understanding where they fit is more valuable than any feature comparison.

If any of this resonates with you, feel free to reach out. I'm always happy to talk.
