---
title: |-
  The web has evolved.
  Finally, testing has too.
description: 'Fast, easy and reliable testing for anything that runs in a browser. Cypress is a complete end-to-end testing framework, in this post I will guide you…'
publishedAt: '2021-09-10T21:51:08.248Z'
updatedAt: '2022-12-02T14:16:01.884Z'
tags:
  - ui
  - js
  - cypress-plugin
  - end-to-end
sourceUrl: 'https://blog.niradler.com/the-web-has-evolved-finally-testing-has-too-cf6fe0f0d805'
originalUrl: 'https://blog.niradler.com/the-web-has-evolved-finally-testing-has-too-cf6fe0f0d805'
sourceMarkdown: 'https://blog.niradler.com/the-web-has-evolved-finally-testing-has-too-cf6fe0f0d805.md'
cover: /media/the-web-has-evolved-finally-testing-has-too-cf6fe0f0d805/cover.jpeg
coverAlt: |-
  The web has evolved.
  Finally, testing has too.
---
# The web has evolved.
Finally, testing has too.

Fast, easy and reliable testing for anything that runs in a browser.

Cypress is a complete end-to-end testing framework, in this post I will guide you through how to get started and use this great tool to test UI.

Setup:

Installation:

```bash
yarn add cypress --dev
```

package.json

```bash
"scripts": {
    "cypress": "./node_modules/.bin/cypress open",
    "test": "./node_modules/.bin/cypress run"
    }
```

Configure:

create `cypress.json` file in the root folder.

```bash
{
  "baseUrl": "https://devresources.site",
  "video": false,
  "pageLoadTimeout": 30000,
  "defaultCommandTimeout": 10000,
  "viewportWidth": 1280,
  "viewportHeight": 720
}
```

start cypress.

```bash
npm run cypress
```

Cypress will set up the cypress folder in your project, and open the cypress test runner.

Our first test:

let’s create our first test, to clean up I will recommend deleting the examples folder in cypress/integration/examples

I’m going to demonstrate on https://devresources.site, let's see what is the feature in the page we want to test, first of all, we want to know resources are populating the page so let's create a test for that.

create our first test file inside cypress/integration/home.spec.js

```bash
/// <reference types="Cypress" />

context('Home page', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('resources loading', () => {
    cy.get('.ant-card-body').should('exist');
  });

  it('categories', () => {
    cy.get('.ant-menu-item').should('exist');
  });
});
```

The steps are as follows, cypress

*   will open a browser and navigate to [https://devresources.site](https://www.devresources.site/) (`cy.visit('/')` → navigate to baseUrl + / )
    
*   run the first test, and look for the class .ant-card-body this class will show only when resources is loaded to the page.
    
*   run the second test, and look for the class .ant-menu-item this class will show only when the categories is loaded.
    

in production environment i will recommend to go more into details, for example a real world example is that cypress can validate that the text in the card is visible and there is no other element that hiding it.

cypress is a very strong tool that can help you cover most of the test for your app, try to use it as much as possible to cover wide range of scenarios, cover edge case and common errors.

[The repo for future reference .](https://github.com/niradler/devresources-client)

Update:

Automatically create and deploy the tests results to github pages as html file.

[Live Demo.](https://niradler.github.io/devresources-client/)

This is my script to automate the process, you can customize it for your need.

// runTestAndReport.js

```bash
const cypress = require('cypress');
const fse = require('fs-extra');
const { merge } = require('mochawesome-merge');
const { create } = require('mochawesome-report-generator');
const ghpages = require('gh-pages');

const reportsDir = './cypress/reports';

const rename = () =>
  new Promise((resolve, reject) => {
    fse.rename(`${reportsDir}/static/mochawesome.html`, `${reportsDir}/static/index.html`, err => {
      if (err) reject(err);
      resolve();
    });
  });

const publish = () =>
  new Promise((resolve, reject) =>
    ghpages.publish(
      `${reportsDir}/static`,
      {
        branch: 'gh-pages',
        repo: 'https://github.com/niradler/devresources-client.git',
      },
      err => {
        if (err) reject(err);
        resolve();
      },
    ),
  );

const options = {
  reportDir: `${reportsDir}/mocha`,
};

async function runTests() {
  await fse.remove(options.reportDir);
  const { totalFailed } = await cypress.run();
  const jsonReport = await merge(options);
  await create(jsonReport, {
    reportDir: `${reportsDir}/static`,
    inline: true,
    overwrite: true,
    reportTitle: 'Devresources.site',
    reportPageTitle: 'Devresources Status',
  });
  await rename();
  await publish();

  process.exit(totalFailed);
}

runTests().catch(e => {
  console.error('cypress: ', e);
  process.exit(1);
});
```
