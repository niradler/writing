---
title: Statikly - No hassle full-stack framework
description: 'Statikly has evolve to Statikly Stack check out the new repo Statikly is a full-stack framework for developers who want to create SSR/static sites, great…'
publishedAt: '2022-12-02T13:27:34.510Z'
updatedAt: '2023-01-31T18:24:50.522Z'
tags:
  - ui
  - nodejs
  - full-stack
sourceUrl: 'https://blog.niradler.com/statikly-no-hassle-full-stack-framework'
originalUrl: 'https://blog.niradler.com/statikly-no-hassle-full-stack-framework'
sourceMarkdown: 'https://blog.niradler.com/statikly-no-hassle-full-stack-framework.md'
series: Open source
seriesSlug: open-source
cover: /media/statikly-no-hassle-full-stack-framework/cover.jpeg
coverAlt: Statikly - No hassle full-stack framework
---
# Statikly - No hassle full-stack framework

> Statikly has evolve to Statikly Stack check out the new repo [https://github.com/niradler/statikly-stack](https://github.com/niradler/statikly-stack)

[Statikly](https://github.com/niradler/statikly) is a full-stack framework for developers who want to create SSR/static sites, great for blog/static/content sites, and excellent for prototype and building internal tools and SEO optimization.

Provide an alternative for writing frontend with endless packages and single-page application frameworks like React/Vue, more and more hype is growing on server-side UI, like next.js and remix, and I wanted to simplify it even more.

Statikly is based on [fastify](https://www.fastify.io/) framework and ecosystem plugins, it's trying not to be very opinionated but to support strong defaults.

let's create our first project

```bash
npm i -g statikly nodemon
mkdir statikly
cd statikly
statikly init # clone niradler/statikly-demo
npm run watch # visit localhost:3000
```

<figure class="media" data-align="left">
<img src="/media/statikly-no-hassle-full-stack-framework/d1a80db3-dbb8-4f63-9217-e8e990f6f618.png" alt="Statikly page titled Todo example, with a My Todos button and a photograph of snowy mountains" loading="lazy" decoding="async" data-align="left">
</figure>

The code behind this page can be found in `views/index.ejs` if you wonder where the rest of the HTML coming from we use the layout feature, the page layout is at `partials\layout.ejs` configured as env var

```bash
STATIKLY_LAYOUT=./partials/layout.ejs
```

in `.env` make sure you don't commit `.env` with secrets to git.

```bash
<section>
  <h1>Todo example</h1>
  <a href="/todos"><button>My Todos</button></a>
</section>

<figure>
  <img src="public/image.jpg" alt="Minimal landscape" />
</figure>
```

Go ahead and play with the demo todo app to figure out how you can pass data to your view with loaders, checkout the todos loader for example `views\todos\index.js`

Supported env vars:

```bash
NODE_ENV=production # optional: set in production
STATIKLY_ROOT= # optional: set to override current folder
STATIKLY_STATIC_FOLDER=public # optional: for other public folder
STATIKLY_TEMPLATE=ejs # optional: template engine to use for the complete list @fastify/view
STATIKLY_LAYOUT= # optional: layout path
STATIKLY_VIEWS=views # optional: for other views folder
STATIKLY_PASSWORD=1234 # optional: basic auth
STATIKLY_USERNAME=user # optional: basic auth
```

Another helpful command will be running `statikly --help`
