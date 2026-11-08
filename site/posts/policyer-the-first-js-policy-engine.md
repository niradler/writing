---
title: Policyer - the first  JS policy engine
description: Policyer is an open-source project (more like a vision) I created after being inspired by policy engines that become very popular lately…
publishedAt: '2021-11-21T11:10:57.000Z'
updatedAt: '2022-12-02T14:15:20.193Z'
tags:
  - js
  - javascript
  - policy-as-code
sourceUrl: 'https://blog.niradler.com/policyer-the-first-js-policy-engine'
originalUrl: 'https://blog.niradler.com/policyer-the-first-js-policy-engine'
sourceMarkdown: 'https://blog.niradler.com/policyer-the-first-js-policy-engine.md'
series: Open source
seriesSlug: open-source
cover: /media/policyer-the-first-js-policy-engine/cover.jpeg
coverAlt: Policyer - the first  JS policy engine
---
# Policyer - the first  JS policy engine

Policyer is an open-source project (more like a vision) I created after being inspired by policy engines that become very popular lately ([**OPA**](https://www.openpolicyagent.org/),[**Checkov**](https://github.com/bridgecrewio/checkov))  
Policyer going to focus on providing a platform to run and create meaningful reports, data engagement and a plugin system to let you provide any data, sometimes it can be k8s YAML and in other cases, it can be user data.

[GitHub repo](https://github.com/niradler/policyer)

### Getting started

checkout the example [repo](https://github.com/niradler/policyer-todo)

```bash
git clone https://github.com/niradler/policyer-todo
cd policyer-todo
npm i
node cli.js -o ./report.json -p ./checks -i false
```

Checks format:

```yaml
---
configuration:
  provider: todo-provider
  type: resource
  resource: todo
  payload:
    id: 1
checks:
  - id: todo-id-check
    name: check if todo has an id.
    severity: High
    steps:
      - path: id
        condition: equal
        utility: isInteger
        value: true
      - path: id
        condition: equal
        value: 1
  - id: todo-title-check
    name: check if todo has a title.
    severity: Warning
    steps:
      - path: title
        condition: not
        utility: isEmpty
        value: true
  - id: todo-completed-check
    name: check if todo has a valid completed field.
    severity: Warning
    steps:
      - path: completed
        condition: includes
        value:
          - true
          - false
```

A check is a set of conditions or policies to enforce, many utilities can help you build complex policies, and you can also add your own when writing your provider.

Policyer is modular, and by nature prefer to be behind the scene and let you customise the user-facing side by the Provider as best fit to your need.

checkout the example repos, contribution is welcome.
