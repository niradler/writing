---
title: AWS CloudFormation Outputs
description: 'My favourite way to deploy resources on AWS is to use Cloudformation (cf), I''m using CDK/Serverless/SST to create my Cloudformation templates. often you…'
publishedAt: '2021-03-14T12:31:44.000Z'
updatedAt: '2021-03-14T12:31:44.000Z'
tags:
  - npm
  - cloudformation
  - client
  - reactjs
sourceUrl: 'https://blog.niradler.com/aws-cloudformation-outputs'
originalUrl: 'https://blog.niradler.com/aws-cloudformation-outputs'
sourceMarkdown: 'https://blog.niradler.com/aws-cloudformation-outputs.md'
series: Open source
seriesSlug: open-source
cover: /media/aws-cloudformation-outputs/cover.jpeg
coverAlt: AWS CloudFormation Outputs
---
# AWS CloudFormation Outputs

My favourite way to deploy resources on AWS is to use Cloudformation (cf), I'm using CDK/Serverless/SST to create my Cloudformation templates.

often you will want to share data between stacks, the recommended way will be stack outputs, to use this output in build (CI/CD) time I needed an easy tool to pull the output into a machine-readable file, for this task I created [cfexport](https://github.com/niradler/cfexport) npm module.

let's look at the following example, we have cf template that deploys our API to AWS APIgateway service, next we have a pipeline to build our client code and upload it to s3, during the build we want to transfer our APIgateway URL to the client build script.

let's look at how we do that with cfexport

```yaml
npm i cfexport
```

next, let's update our scripts filed in `package.json`

```yaml
"pre-build":"cfexport compile -v --file \"./.env.template\" --region us-east-1 --output \"./.env\" --format \".env\""
```

and create our template file `.env.template`

```bash
REACT_APP_APPLICATION_URL=DEV-APIGATEWAY-URL // you can use --prefix DEV- and then just put APIGATEWAY-URL
REACT_APP_IGNORE_PARAM=!dont-change // value starting with ! will be ignored.
```

running `npm run pre-build` will create `.env` file, and replace `DEV-APIGATEWAY-URL` value with the export value (export name should be = `DEV-APIGATEWAY-URL`), values starting with ! will be ignored and ! will be removed.

```bash
REACT_APP_APPLICATION_URL=https://{restapi_id}.execute-api.{region}.amazonaws.com/{stage_name}/
REACT_APP_IGNORE_PARAM=dont-change
```
