---
title: Consolidate alerts with Feeder
description: 'Feeder is a self-hosted alert feed, you can use it to consolidate alerts from multiple sources, in my case I''m using it to get alerts on the status of my…'
publishedAt: '2023-02-07T21:03:46.148Z'
updatedAt: '2023-02-19T23:42:49.256Z'
tags:
  - opensource
  - alert
  - notifications
  - statikly
  - htmx
sourceUrl: 'https://blog.niradler.com/consolidate-alerts-with-feeder'
originalUrl: 'https://blog.niradler.com/consolidate-alerts-with-feeder'
sourceMarkdown: 'https://blog.niradler.com/consolidate-alerts-with-feeder.md'
series: Open source
seriesSlug: open-source
cover: /media/consolidate-alerts-with-feeder/cover.jpeg
coverAlt: Consolidate alerts with Feeder
---
# Consolidate alerts with Feeder

Feeder is a self-hosted alert feed, you can use it to consolidate alerts from multiple sources, in my case I'm using it to get alerts on the status of my open source projects and self-hosted apps, any issues with one of these products will trigger a POST request to Feeder `/webhook`.

Feeder is built on SSR (Server Side Rendering) technologies.  
My personal orientation is to the backend side, so I prefer to avoid client frameworks like React/Vue and such.  
Instead, I'm using my own framework, Statikly, which is basically an opinionated Fastify template.

Feeder uses SSE (Server Sent Event), for real-time alert updates.

<figure class="media" data-align="center">
<img src="/media/consolidate-alerts-with-feeder/ccde9a3b-d97d-4aa4-8aad-e0c1939aed99.gif" alt="Feeder receiving live alerts over server-sent events" loading="lazy" decoding="async" data-align="center">
</figure>

Feeder has one main page, the alerts page, you can search alerts by content, and tags, powered by Htmx, the alerts interaction feels like SPA (Single Page Application).

<figure class="media" data-align="center">
<img src="/media/consolidate-alerts-with-feeder/1619a79e-d07e-4830-bc37-397b24751a52.png" alt="Feeder alerts page, where alerts can be searched by content and tags" loading="lazy" decoding="async" data-align="center">
</figure>

Another cool feature is the themes support, I'm using DaisyUI which comes with a pre-build set of themes, you can play with it and choose the theme you like.

<figure class="media" data-align="center">
<img src="/media/consolidate-alerts-with-feeder/50aac82b-4e9b-4ddb-a3ac-924a472066e5.png" alt="Feeder theme choices" loading="lazy" decoding="async" data-align="center">
</figure>

Alerts fields

```markdown
-   `title` - The title of the alert
-   `description` - The description of the alert
-   `level` - The level of the alert, can be empty/error/warning/info
-   `action` - The form action for the alert (trigger by the response button, see image above)
-   `actionMethod` - The form method for the alert, default to `POST`
-   `timestamp` - The timestamp for the alert
-   `tags` - The tags for the alert (experimental)
-   `groupId` - The groupId for the alert (experimental)
```

You can click an alert to see more details. If an action is present on the alert, a response button will be shown to trigger the action, this opens the way to cool interactions like confirming reading and action to deal with alerts. For example, an alert for a server that is not responding and an action response to restart the server.

Tech stack:

* [Statikly](https://github.com/niradler/statikly-stack) + [Fastify](https://www.fastify.io/)
    
* [Tailwind](https://tailwindcss.com/) + [DaisyUI](https://daisyui.com/)
    
* [Htmx](https://htmx.org/)
    

Checkout the Github repository for more [https://github.com/niradler/feeder](https://github.com/niradler/feeder)

Demo with n8n integration

<figure class="media" data-align="center">
<img src="/media/consolidate-alerts-with-feeder/ac9f29ae-6fff-4546-8452-05c9cf9252ec.gif" alt="Feeder demo with an n8n integration" loading="lazy" decoding="async" data-align="center">
</figure>
