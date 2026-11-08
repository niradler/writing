---
title: Cloudflare automatic DNS update for homelab
description: 'First of all, I love Cloudflare, I think they have a great product, I use Cloudflare to manage all my DNS, anyone that has a homelab setup knows you need…'
publishedAt: '2022-03-26T08:31:40.000Z'
updatedAt: '2023-01-04T19:24:03.923Z'
tags:
  - homelab
  - docker
  - golang
sourceUrl: 'https://blog.niradler.com/cloudflare-automatic-dns-update-for-homelab'
originalUrl: 'https://blog.niradler.com/cloudflare-automatic-dns-update-for-homelab'
sourceMarkdown: 'https://blog.niradler.com/cloudflare-automatic-dns-update-for-homelab.md'
series: Open source
seriesSlug: open-source
cover: /media/cloudflare-automatic-dns-update-for-homelab/cover.jpeg
coverAlt: Cloudflare automatic DNS update for homelab
---
# Cloudflare automatic DNS update for homelab

First of all, I love Cloudflare, I think they have a great product, I use Cloudflare to manage all my DNS, anyone that has a homelab setup knows you need to figure out a way to keep Cloudflare IP update if your home IP is changed, there are many great solutions out there but I love to create my own tools, so I created [cloudflaresync](https://github.com/niradler/cloudflaresync).

My home lab setup is a set of docker-compose files, everything is dockerized so this was the obvious choice, I'm trying to learn Golang so written in Go, and the code is very simple, but taylormade to my need.

```yaml
# docker-compose
version: '3.4'

services:
  cloudflaresync:
    image: niradler/cloudflaresync
    env_file:
      - .env
```

The code is very straightforward, we get the configuration from a set of env vars, and configure a cron task to run every x time to update DNS records with new IP, I'm also using it to create new records when a new service is created.

```go
// main.go
package main

import (
	...

	"github.com/cloudflare/cloudflare-go"
	"github.com/joho/godotenv"
	"github.com/robfig/cron/v3"
)

....

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Println("Error loading .env file")
	}
	updateRecords()
	log.Println("Start cron", time.Now())
	cronExpression, exist := os.LookupEnv("CRON")
	if !exist {
		cronExpression = "0 * * * *"
	}
	log.Println("cron:", cronExpression)
	c := cron.New()
	id, err := c.AddFunc(cronExpression, updateRecords)
	if err != nil {
		log.Fatal("cron AddFunc error:", err)
	}
	log.Println("cron id:", id)
	c.Start()
	log.Println("Cron Info: ", c.Entries())

	go forever()

	quitChannel := make(chan os.Signal, 1)
	signal.Notify(quitChannel, syscall.SIGINT, syscall.SIGTERM)
	<-quitChannel

	fmt.Println("done")
}
```

Supported env vars:

```bash
CLOUDFLARE_API_TOKEN=<key>
CLOUDFLARE_DOMAIN=example.com
CLOUDFLARE_SUB_DOMAINS=test,home
CRON=*/2 * * * *
PROXIED=true
```

Running example for raspberry pi.

```bash
docker run --name cloudflaresync --env CLOUDFLARE_API_TOKEN=<key> --env CLOUDFLARE_SUB_DOMAINS=<app,home> --env CLOUDFLARE_DOMAIN=<example.com> --restart unless-stopped niradler/cloudflaresync:armv7
```

**Updated** to automatically update record from container label, check out the repo for more details [https://github.com/niradler/cloudflaresync](https://github.com/niradler/cloudflaresync)

```plaintext
version: "3.5"

services:
  cloudflaresync:
    image: niradler/cloudflaresync:latest
    restart: unless-stopped
    environment:
      CLOUDFLARE_API_TOKEN: "${CLOUDFLARE_API_TOKEN}"
      CLOUDFLARE_DOMAIN: "${DOMAIN}"
      CLOUDFLARE_SUB_DOMAINS: "${SUB_DOMAINS}"
      DOCKER_DAEMON: 'true'
    labels:
      - homepage.show=true
      - homepage.description=cloudflaresync
      - homepage.title=cloudflaresync
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
```

```plaintext
version: "3.5"

services:
  adminer:
    image: adminer:latest
    labels:
      - cloudflaresync.name=adminer
```

will automatically create a record `adminer.domain`
