---
title: Serverless Authentication with Golang
description: 'Almost every project needs authentication to serve secure user content. For most of my side projects, I prefer to pay per use for cost optimization…'
publishedAt: '2022-07-04T12:40:16.000Z'
updatedAt: '2022-07-04T12:40:16.000Z'
tags:
  - go
  - golang
  - authentication
  - aws
  - dynamodb
sourceUrl: 'https://blog.niradler.com/serverless-authentication-with-golang'
originalUrl: 'https://blog.niradler.com/serverless-authentication-with-golang'
sourceMarkdown: 'https://blog.niradler.com/serverless-authentication-with-golang.md'
series: Open source
seriesSlug: open-source
cover: /media/serverless-authentication-with-golang/cover.jpeg
coverAlt: Serverless Authentication with Golang
---
# Serverless Authentication with Golang

Almost every project needs authentication to serve secure user content.

For most of my side projects, I prefer to pay per use for cost optimization.

continuing my experiment with Golang, I created Golang service that's going to run inside AWS Lambda function and store the data in Dynmodb database, I'm using serverless AWS services to fulfil my requirement of cost optimize service.

[GitHub repo](https://github.com/niradler/serverless-auth-go)

### Features

*   Email/password login
    
*   Forgot password
    
*   Provider login using google/github and more
    
*   Multi tenant(orgs)
    
*   Store user data on signup
    
*   Basic roles
    
*   Invite users
    
*   Emails template
    
*   JWT
    

**Supported routes:**

| method | route | payload | Role | public | description |
| --- | --- | --- | --- | --- | --- |
| POST | /v1/auth/login | email, password |  | true | Login |
| POST | /v1/auth/login/email | email |  | true | Passwordless Login |
| POST | /v1/auth/signup | email, password, data |  | true | Signup |
| GET | /v1/auth/validate |  |  | true | ValidateToken |
| POST | /v1/auth/renew |  |  | false | Get new Token |
| GET | /v1/auth/provider/:provider |  |  | true | Login with provider |
| GET | /v1/auth/provider/:provider/callback |  |  | true | Validate provider login |
| GET | /v1/users/me |  |  | true | Health check |
| PUT | /v1/users/me | data |  | false | Update user data |
| PUT | /v1/users/me/password | password,repeated password |  | false | Update user password |
| POST | /v1/orgs | name |  | false | Create Org |
| POST | /v1/orgs/:orgId/invite | email, role | admin | false | Invite user to me org |
| GET | /v1/orgs/:orgId/users |  | admin | false | Get org users |
