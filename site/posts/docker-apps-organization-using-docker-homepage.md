---
title: Docker Apps Organization Using Docker Homepage
description: 'doc-home is a way to manage and monitor your Docker containers from a graphical user interface. To get started, simply run the following docker compose…'
publishedAt: '2023-01-04T21:33:20.468Z'
updatedAt: '2023-01-04T21:42:04.918Z'
tags:
  - opensource
  - docker
  - docker-compose
sourceUrl: 'https://blog.niradler.com/docker-apps-organization-using-docker-homepage'
originalUrl: 'https://blog.niradler.com/docker-apps-organization-using-docker-homepage'
sourceMarkdown: 'https://blog.niradler.com/docker-apps-organization-using-docker-homepage.md'
series: Open source
seriesSlug: open-source
cover: /media/docker-apps-organization-using-docker-homepage/cover.jpeg
coverAlt: Docker Apps Organization Using Docker Homepage
---
# Docker Apps Organization Using Docker Homepage

doc-home is a way to manage and monitor your Docker containers from a graphical user interface.

<figure class="media" data-align="left">
<img src="/media/docker-apps-organization-using-docker-homepage/homepage.png" alt="" loading="lazy" decoding="async" data-align="left">
</figure>

To get started, simply run the following docker compose

```plaintext
version: "3.4"

services:
  doc-home:
    container_name: doc-home
    image: niradler/doc-home
    restart: always
    environment:
      NODE_ENV: production
      STATIKLY_PASSWORD: ${STATIKLY_PASSWORD}
      STATIKLY_USERNAME: ${STATIKLY_USERNAME}
    ports:
      - 3111:3001
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
```

Available environment variables:

```markdown
# .env
STATIKLY_PASSWORD= # required, to make this optional remove basicAuth from statikly.json
STATIKLY_USERNAME= # required, to make this optional remove basicAuth from statikly.json
SSH_HOST= # optional
SSH_KEY_PATH= # optional
SSH_USERNAME= # optional
```

*Add apps to the home page by adding docker labels to your running containers*

```plaintext
version: "3.4"

services:
  mongo_container:
    container_name: mongo_service
    image: mongo
    labels:
      - homepage.show=true
      - homepage.description=proxy manager
      - homepage.title=nginx-proxy-manager
      - homepage.domain=https://proxy.niradler.com
    ports:
      - 3201:27017
```

<figure class="media" data-align="left">
<img src="/media/docker-apps-organization-using-docker-homepage/containers.png" alt="" loading="lazy" decoding="async" data-align="left">
</figure>

Visit the Github Repo at [https://github.com/niradler/doc-home](https://github.com/niradler/doc-home)
