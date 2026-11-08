---
title: Introduction for remote-deployer.
description: My new open-source package remote-deployer includes core features to make the deployment process much easier and safer. The idea to create the package…
publishedAt: '2018-11-14T20:47:41.000Z'
updatedAt: '2022-12-02T00:35:27.125Z'
tags:
  - aws
  - deployment
  - nodejs
  - tool
  - deploy
sourceUrl: 'https://blog.niradler.com/introduction-for-remote-deployer'
originalUrl: 'https://niradler.com/introduction-remote-deployer/'
sourceMarkdown: 'https://blog.niradler.com/introduction-for-remote-deployer.md'
series: Open source
seriesSlug: open-source
cover: /media/introduction-for-remote-deployer/cover.png
coverAlt: Introduction for remote-deployer.
---
# Introduction for remote-deployer.

My new open-source package remote-deployer includes core features to make the deployment process much easier and safer.

The idea to create the package, came when I tried to set up CI/CD with GitLab worker for my new project ([devresources](https://github.com/niradler/devresources-client)).

The worker has stages like test, build, and deploy. Deployer is used in the deploy stage, after test and build, fire an event to update, the server, and a script on the server will pull from git and build the new version.

Deploy with **deployer** is intuitive and you can use HTTP/SSH and soon FTP method to deploy to a remote server (like AWS ec2 server), let's give it a try.

```plaintext
npm i -g remote-deployer && deployer
```

<figure class="media" data-align="left">
<img src="/media/introduction-for-remote-deployer/EqIC61EXU.png" alt="Introduction to my new tool remote-deployer." loading="lazy" decoding="async" data-align="left">
</figure>

First let's decide on the way we going to use deployer, deployer as for today have 2 ways to deploy ssh/http.

HTTP:

This method is for installing on the server, this is the easier way, all we do is to send and forget, an easy way to trigger the deploy.

```plaintext
cd ./project_directory
deployer init
```

The **deployer** will start the initialise process.

```plaintext
A git repository was not found!
? Should we create one for you ? No
? Pick deploy method: HTTP
```

After completing the process let's fire up the deployment server.

```plaintext
deployer http start
```

pm2 will fire up the server. (by the way make sure pm2 is installed, npm i -g pm2).

Now to deploy you can simply create a get call to your server IP and the port you configure, make sure to open the port in the network setting or firewall.

This is an example of how the call will look like

```plaintext
curl http://server-ip:5454/deploy?appKey=bbd120510e451a5e89cb5b829e336f771k12ba79
```

This Is it! very easy, in the end of the article, I will show a deployment script example.

SSH:

This method is for installing on the client (developer computer or build server), this is the more advanced, secure and flexible way we run a local script on the remote machine, in this way it is very easy to edit the deploy script and get the output of the deployment.

```plaintext
cd ./project_directory
deployer init
```

The **deployer** will start the initialise process.

```plaintext
A git repository was not found!
? Should we create one for you ? No
? Pick deploy method: SSH```
```

After completing the process let's fire up the deployment script.

```plaintext
deployer ssh deploy
```

The **deployer** will connect to the server by secure connection over SSL, and run the commands from the script line by line.

This is an example of how the call will look like

```plaintext
#!/bin/bash

cd ~/app/project_directory

git pull --force

docker-compose -f "docker-compose.yml" down
docker-compose -f "docker-compose.yml" up -d --build
docker logs project-client_1
docker logs project-server_1

echo "FINISHED DEPLOYMENT!"
```

*   don't forget to use the help command, `deployer -h` or `deployer ssh -h`
    

Example  of configuration file for gitlab worker `.gitlab-ci.yml` .

```plaintext
image: node:alpine

before_script:
  -  apk update && apk add curl

stages:
  - test-server
  - build-client
  - deploy

test-server:
  stage: test-server
  script:
    - cd ./server
    - npm install
    - npm run test

build-client:
  stage: build-client
  script:
    - cd ./client
    - npm i
    - npm run test
    - npm run build

deploy:
  stage: deploy
  script:
    - curl http://server-ip:5454/deploy?appKey=bkd100530d411a5e19cb5b829e336f7710e3ba71
```

Visit the project on [github](https://github.com/niradler/remote-deployer).
