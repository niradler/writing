---
title: Export Swagger documentation file from AWS ApiGateway
description: 'When developing a serverless function over AWS lambda and APIGateway, it is very useful to export the documentation as a swagger file, and create API…'
publishedAt: '2019-04-23T22:00:03.000Z'
updatedAt: '2019-04-23T22:00:03.000Z'
tags:
  - aws
  - npm
  - api-gateway
sourceUrl: 'https://blog.niradler.com/export-swagger-documentation-file-from-aws-apigateway'
originalUrl: 'https://niradler.com/export-swagger-file-from-aws-apigateway/'
sourceMarkdown: 'https://blog.niradler.com/export-swagger-documentation-file-from-aws-apigateway.md'
series: Open source
seriesSlug: open-source
cover: /media/export-swagger-documentation-file-from-aws-apigateway/cover.jpeg
coverAlt: Export Swagger documentation file from AWS ApiGateway
---
# Export Swagger documentation file from AWS ApiGateway

When developing a serverless function over AWS lambda and APIGateway, it is very useful to export the documentation as a swagger file, and create API documentation to your API.

to make the process smooth I created an npm module apigateway-export-tool that does exactly that.

```plaintext
npx apigateway-export-tool list
npx apigateway-export-tool docs -i [api-id] --stageName [stage]
```

I'm using the `aws-sdk` module to export the API documentation by `api-id` and `stage-name`.

you can also use the module with NodeJS like this:

```plaintext
const { getExportAndSave,setAwsConfig } = require("apigateway-export-tool");
setAwsConfig({ region: "us-east-1" });

(async function() {
  const params = {
    exportType, // String ("oas30", "swagger")
    restApiId, // String
    stageName, // String
    parameters: {
      extensions // String ("postman", "integrations", "integrations", "authorizers")
    }
  };
  const filePath = "./";
  const file = await getExportAndSave(params, filePath); //save the file in path.
  const file = await getExportAndSave(params); // just returning the file.
})();
```

after exporting the swagger file go over to [https://editor.swagger.io/](https://editor.swagger.io/) and import the file, then you can interact with your API documentation.

in my next [post](https://blog.niradler.com/automatically-serve-swagger-ui-for-api-gateway-documentation), I will show you my next project to combine the swagger UI with the swagger exporter.
