---
title: Bootstrap your next project with npm init
description: 'With the latest npm versions, you can trigger npx with npm init. Try it out with: Basically behind the scene, npm init will run npx create-react-app Based…'
publishedAt: '2019-04-16T20:27:22.000Z'
updatedAt: '2019-04-16T20:27:22.000Z'
tags:
  - npm
  - opensource
sourceUrl: 'https://blog.niradler.com/bootstrap-your-next-project-with-npm-init-f314c2b11027'
originalUrl: 'https://blog.niradler.com/bootstrap-your-next-project-with-npm-init-f314c2b11027'
sourceMarkdown: 'https://blog.niradler.com/bootstrap-your-next-project-with-npm-init-f314c2b11027.md'
series: Open source
seriesSlug: open-source
cover: /media/bootstrap-your-next-project-with-npm-init-f314c2b11027/cover.png
coverAlt: Bootstrap your next project with npm init
---
# Bootstrap your next project with npm init

With the latest npm versions, you can trigger `npx` with npm init.

Try it out with:

```plaintext
npm init react-app
```

Basically behind the scene, npm init will run `npx create-react-app`

Based on that knowledge, let’s create a bootstrapper package and deploy it to the npm registry.

The bootstrapper I decided to create is for open-source projects.

Features:

*   Run git init
    
*   Create license file
    
*   Create git ignore file
    
*   Create CODE\_OF\_CONDUCT.md
    
*   Run npm init -y
    
*   Add initial git commit.
    

The code: ( [github](https://github.com/niradler/create-open-source))

Let’s pick a name for our package, we learned we need to prefix the name with create- and we are going to create package for open source project so the obvious name is going to be create-open-source.

For those who didn’t try to publish packages to the npm registry, you should sign up on npmjs.com and try npm publish in your project folder, make sure the name is unique.

Now let’s try it out:

```plaintext
mkdir new-project 
cd new-project 
npm init open-source
```

*Originally published at* [*https://niradler.com*](https://niradler.com/bootstrap-your-next-project-with-npm-init/) *on April 16, 2019.*
