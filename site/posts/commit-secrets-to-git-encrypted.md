---
title: Commit secrets to Git (encrypted)
description: 'As part of the covid-19 extra free time, I''m learning google cloud and terraform. My first experiment was to deploy a simple docker file to cloud run…'
publishedAt: '2020-04-04T15:27:31.000Z'
updatedAt: '2022-12-02T14:19:23.688Z'
tags:
  - git
  - npm
  - terraform
  - github
  - secrets
sourceUrl: 'https://blog.niradler.com/commit-secrets-to-git-encrypted'
originalUrl: 'https://niradler.com/commit-secrets-to-git-encrypted/'
sourceMarkdown: 'https://blog.niradler.com/commit-secrets-to-git-encrypted.md'
series: Open source
seriesSlug: open-source
cover: /media/commit-secrets-to-git-encrypted/cover.jpeg
coverAlt: Commit secrets to Git (encrypted)
---
# Commit secrets to Git (encrypted)

As part of the covid-19 extra free time, I'm learning google cloud and terraform.

My first experiment was to deploy a simple docker file to cloud run service and to set up a custom domain.

When I got the results needed, I wanted to commit the files to Github, but I've found out that the terraform files can expose secrets. To avoid using a third party solution, I decided to use a tool to encrypt the files before committing. I looked for a simple solution, self-contained and portable, so I decided to create my own solution.

[git-secrets](https://github.com/niradler/git-secrets) - simple npm package that can be used with husky (git hooks), to transparent encrypt and decrypt files in your repo.

Setup:

```plaintext
npm i -S git-secrets husky

  "scripts": {
    "start": "node src/server.js",
    "infra:init": "terraform init",
    "infra:plan": "terraform plan",
    "infra:deploy": "terraform apply",
    "infra:destroy": "terraform destroy",
    "secret:init": "./node_modules/.bin/git-secrets init",
    "secret:hide": "./node_modules/.bin/git-secrets hide",
    "secret:reveal": "./node_modules/.bin/git-secrets reveal"
  },
  "husky": {
    "hooks": {
      "pre-commit": "npm run secret:hide && git add .",
      "post-commit": "npm run secret:reveal"
    }
  },

npm run secret:init
```

Now, add files you would like to encrypt before committing them to the config file.

.git-secrets (can be any other file by setting env variable GIT\_SECRETS\_CONFIG)

```plaintext
terraform.tfstate
variables.tf
secrets.json
```

The next step is to choose your secret password and pass it to git-secrets. You can pass the key by cli param (--key=secret), env variable  (GIT\_SECRETS\_KEY), and by creating the key file (make sure you add this file to .gitignore, filename=.git-secrets.key)

The final step is to test all our configurations, commit the changes we just added and check the files on GitHub to see the result.

*   *disclaimer: this is a work in progress and not safe for production or enterprise projects, but can do the trick for self-projects when the risk is low.*
