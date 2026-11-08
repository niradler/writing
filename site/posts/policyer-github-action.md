---
title: Policyer Github Action
description: My submission to the GitHub Actions x DEV Hackathon 2021! Policyer is an open-source project (more like a vision) I created after being inspired by policy…
publishedAt: '2021-12-05T22:14:26.000Z'
updatedAt: '2022-12-02T10:49:34.978Z'
tags:
  - github
  - github-actions-1
  - hackathon
sourceUrl: 'https://blog.niradler.com/policyer-github-action'
originalUrl: 'https://niradler.com/policyer-github-action/'
sourceMarkdown: 'https://blog.niradler.com/policyer-github-action.md'
series: Hackathons
seriesSlug: hackathons
cover: /media/policyer-github-action/cover.png
coverAlt: Policyer Github Action
---
# Policyer Github Action

My submission to the GitHub Actions x DEV Hackathon 2021!

### My Workflow

Policyer is an open-source project (more like a vision) I created after being inspired by policy engines that become very popular lately ([OPA](https://www.openpolicyagent.org/),[Checkov](https://github.com/bridgecrewio/checkov))  
Policyer going to focus on providing a platform to run and create meaningful reports, data engagement and a plugin system to let you provide any data, sometimes it can be k8s YAML and in other cases, it can be user data.

## Policyer Action

The [policyer-action](https://github.com/niradler/policyer-github) lets you the option to run [policyer](https://github.com/niradler/policyer) as part of your CI process, in my example I'm going to validate GitHub SDK calls.

***The provider is like a plugin for policyer engine, it provides the data so the engine can run it against the checks (polciies)***

It's important for me to emphasise that Policyer provide a platform, and eventually I will want to see a marketplace full of people custom providers.  
The action can use any provider either local or published to NPM (support for private registries is on the way). In my example, I created a simple provider to run GitHub SDK calls.

[Example Repo](https://github.com/niradler/policyer-github)

Example Check:

```plaintext
---
configuration:
  provider: github-provider
  type: rest
  validEvents:
    - pull_request
    - push
  domain: pulls
  action: listRequestedReviewers
  args:
    owner: context.payload.pull_request.base.user.login
    repo: context.payload.pull_request.base.repo.name
    pull_number: context.payload.pull_request.number
checks:
  - id: validate-reviewers
    name: check if reviewers exists.
    severity: High
    steps:
      - path: data.users
        condition: includes
        value: "nirtester"
        utility: map
        utilityProps:
          - "login"
```

(just a reminder this is a policy example and the GitHub action will evaluate it and output it as a report)

Check flow:

*   first of all we setup the configuration section where we can provide metadata for the check, in this example I'm asking the provider to do an SDK call:  
    SDK\[pulls\]\[listRequestedReviewers\]({  
    owner: ...pull\_request.base.user.login  
    repo: ...pull\_request.base.repo.name  
    pull\_number: ...pull\_request.number  
    })  
    [octokit docs](https://octokit.github.io/rest.js/v18#pulls-list-requested-reviewers)
    
*   next, we going to dive into the actual policy, in this policy we want to verify a certain user is a reviewer, so after the call I'm going to point to the "users" array, then use the condition includes (\[...users\].includes(value)), utilities function by default includes all [Lodash](https://lodash.com/) functions, you can add custom utilities in the provider level.  
    I'm going to use the map utility function to prepare an array of reviewers' usernames.
    
*   the final step is the results:
    

### Submission Category:

Wacky Wildcards

### Action YAML

```plaintext
# Add github action file .github/workflows/policyer.yml
name: Policyer

on: [pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Policyer GitHub Action
        uses: policyerorg/policyer-action@v0.0.3-alpha
        with:
          verbose: false
          provider: policyer-github
          internal: false
          checks_path: ./checks
```

## Additional Resources / Info

Visit [Policyer](https://www.policyer.org/) for more information this is just the beginning

## Packages used

*   chalk
    
*   figlet
    
*   jmespath
    
*   lodash
    
*   moment
    
*   yaml
    
*   yargs
    
*   @actions/core/github
