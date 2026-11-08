---
title: Open Source Dashboard (for js developers)
description: Javascript open-source maintainers often have a hard time tracking their npm package status. I used until recently npm-stats.com to get npm information…
publishedAt: '2019-06-15T16:00:02.000Z'
updatedAt: '2022-12-02T00:34:30.065Z'
tags:
  - npm
  - dashboard
  - opensource
sourceUrl: 'https://blog.niradler.com/open-source-dashboard-for-js-developers'
originalUrl: 'https://niradler.com/open-source-dashboard-npm/'
sourceMarkdown: 'https://blog.niradler.com/open-source-dashboard-for-js-developers.md'
series: Open source
seriesSlug: open-source
cover: /media/open-source-dashboard-for-js-developers/cover.png
coverAlt: Open Source Dashboard (for js developers)
---
# Open Source Dashboard (for js developers)

Javascript open-source maintainers often have a hard time tracking their npm package status.

> I used until recently npm-stats.com to get npm information about my packages, recently the site stops to work, so as a coder it was an easy decision to start working on a clone.

The package I created is called npmdash. (short for npm dashboard)

<figure class="media" data-align="left">
<img src="/media/open-source-dashboard-for-js-developers/GV9w3XVCL.png" alt="Open Source Dashboard (for js developers)" loading="lazy" decoding="async" data-align="left">
</figure>

The homepage is a very simple input field to enter the npm username. (be patient it can take a while.)

<figure class="media" data-align="left">
<img src="/media/open-source-dashboard-for-js-developers/qeCe_nRex.png" alt="Open Source Dashboard (for js developers)" loading="lazy" decoding="async" data-align="left">
</figure>

This is the packages view it's a list of the packages sorted by monthly downloads, including data on the package that can help you get more insight into the package, in the future more relevant data will be added.

You can use the [hosted](http://npm.devresources.site/) version, the docker version or the open-source CLI option.

The hosted version uses AWS fargate, you can clone the repo and build your docker version if needed, and deploy it to your own container solution.

CLI Usage

```plaintext
npm i -g npmdash
npmdash // will open the homepage
npmdash -u <username> // will open the packafes view for this username
```

Docker Usage

```plaintext
docker pull niradler/npmdash
docker container run -p 8989:8989 npmdash
```

For future improvements, I will like to improve the GitHub integration, improve the UI and get reports maybe? Still thinking about it.

Enjoy and let me know what you think :)
