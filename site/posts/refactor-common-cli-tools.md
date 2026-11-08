---
title: Refactor Common CLI Tools
description: All of us command line fans have our common CLI tools ready for tasks such as jq for JSON manipulation and curl for creating HTTP requests. I decided to…
publishedAt: '2020-02-10T23:22:19.000Z'
updatedAt: '2020-02-10T23:22:19.000Z'
tags:
  - cli
  - terminal
  - github
  - js
sourceUrl: 'https://blog.niradler.com/refactor-common-cli-tools'
originalUrl: 'https://niradler.com/refactor-common-cli-tools/'
sourceMarkdown: 'https://blog.niradler.com/refactor-common-cli-tools.md'
series: Open source
seriesSlug: open-source
cover: /media/refactor-common-cli-tools/cover.jpeg
coverAlt: Refactor Common CLI Tools
---
# Refactor Common CLI Tools

All of us command line fans have our common CLI tools ready for tasks such as `jq` for JSON manipulation and curl for creating HTTP requests.

I decided to revisit these tools and refactor them to check if I can make them more flexible and easy to use basically to make them a bit more modern.

These is the tools I created:  
1\. [json-cli-tool](https://www.npmjs.com/package/json-cli-tool) - Manipulate JSON.  
2\. [loop-pipe](https://www.npmjs.com/package/loop-pipe) - Loop over piped data.  
3\. [transform-cli](https://www.npmjs.com/package/transform-cli) - Transform data types for now just from and to base64.  
\* just to mention [github-kit-cli](https://www.npmjs.com/package/github-kit-cli) this is the gkc in the example until Github will finish GitHub CLI this is my solution.

Let's look at this example, this commands going to log the content of the readme file from my GitHub repos.

```plaintext
gkc search repos -p="q=org:niradler" | jc --p="items" --fm="name" --o="newline" | lp "gkc repos getContents -p=\"owner=niradler&repo={v}&path=README.md\" | jc --p=\"content\" | tc --ft=\"base64\" --tt=\"txt\""
```

or the longer version

```plaintext
gkc search repos --params="q=org:niradler" | jc --path="items" --flatMap="name" --output="newline" | lp "gkc repos getContents --params=\"owner=niradler&repo={v}&path=README.md\" | jc --path=\"content\" | tc --fromType=\"base64\" --toType=\"txt\""
```

Let's break this down:  
1\.  query Github API to get my repos names. (gkc)  
2\. manipulate JSON response to a flattering list. (jc)  
3\. loop over the list of repos and run commands for each repo. (lp)

These tools will probably not replace `jq`, `sed`, `xargs` and others but I find them easier to use so I can save these big guns for more heavy duty.

This is just a POC to test if this path is even a thing, do I really want to refactor amazing tools that have been battle tests? not sure about this, but for now I'm enjoying the easy usage, and testing new capabilities.
