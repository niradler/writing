---
title: Automatically serve Swagger ui for Api Gateway documentation
description: 'When developing serverless functions and an API on AWS cloud platform, you also create an open API definition (swagger documentation), to download the file…'
publishedAt: '2019-04-30T21:11:35.000Z'
updatedAt: '2019-04-30T21:11:35.000Z'
tags:
  - api
  - aws
  - api-gateway
  - swagger
  - openapi
sourceUrl: 'https://blog.niradler.com/automatically-serve-swagger-ui-for-api-gateway-documentation'
originalUrl: 'https://niradler.com/automatically-serve-swagger-ui-for-api-gateway-documentation/'
sourceMarkdown: 'https://blog.niradler.com/automatically-serve-swagger-ui-for-api-gateway-documentation.md'
series: Open source
seriesSlug: open-source
cover: /media/automatically-serve-swagger-ui-for-api-gateway-documentation/cover.png
coverAlt: Automatically serve Swagger ui for Api Gateway documentation
---
# Automatically serve Swagger ui for Api Gateway documentation

When developing serverless functions and an API on AWS cloud platform, you also create an open API definition (swagger documentation), to download the file easily from the command line you can use tools like `aws-cli` or npm [package](https://github.com/niradler/apigateway-export-tool).

OK! so now what? we have the swagger file an ugly JSON or YAML that doesn't really help us by itself, so now we need to use swagger UI, or swagger editor, to see and interact with our API documentation.

Again why not automate the process, [micro-swagger](https://www.npmjs.com/package/micro-swagger) was born, and what we doing with micro-swagger is connecting these two steps into one elegant process, micro-swagger will download and serve the file locally for you to use and interact with.

```plaintext
npm i -g micro-swagger
micro-swagger start
```

This is it, the browser will pop up with the UI, fetching the API docs from AWS API Gateway (the first load is slow if you have many APIs), in the list you can pick a stage, like prod, and you will get a list of all the APIs in this stage, you can use the swagger UI by clicking the name to the editor by clicking the pencil icon.

<figure class="media" data-align="left">
<img src="/media/automatically-serve-swagger-ui-for-api-gateway-documentation/rRECfQIZT.png" alt="Automatically serve Swagger ui for Api Gateway documentation" loading="lazy" decoding="async" data-align="left">
</figure>
<figure class="media" data-align="left">
<img src="/media/automatically-serve-swagger-ui-for-api-gateway-documentation/Tzf4SeH69R.png" alt="Automatically serve Swagger ui for Api Gateway documentation" loading="lazy" decoding="async" data-align="left">
</figure>
<figure class="media" data-align="left">
<img src="/media/automatically-serve-swagger-ui-for-api-gateway-documentation/43WKExELh.png" alt="Automatically serve Swagger ui for Api Gateway documentation" loading="lazy" decoding="async" data-align="left">
</figure>
<figure class="media" data-align="left">
<img src="/media/automatically-serve-swagger-ui-for-api-gateway-documentation/F5XSu50M_.png" alt="Automatically serve Swagger ui for Api Gateway documentation" loading="lazy" decoding="async" data-align="left">
</figure>
