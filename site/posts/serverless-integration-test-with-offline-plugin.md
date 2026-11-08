---
title: Serverless Integration Test with Offline Plugin
description: 'The Test we are going to create today will demonstrate adding an integration test (API test) to your serverless project. The Tech Stack: NodeJS, Jest…'
publishedAt: '2019-06-01T12:52:16.000Z'
updatedAt: '2019-06-01T12:52:16.000Z'
tags:
  - lambda
  - aws
  - nodejs
  - serverless
  - test
sourceUrl: 'https://blog.niradler.com/serverless-integration-test-with-offline-plugin'
originalUrl: 'https://niradler.com/serverless-integration-tests-with-offline-plugin/'
sourceMarkdown: 'https://blog.niradler.com/serverless-integration-test-with-offline-plugin.md'
cover: /media/serverless-integration-test-with-offline-plugin/cover.png
coverAlt: Serverless Integration Test with Offline Plugin
---
# Serverless Integration Test with Offline Plugin

The Test we are going to create today will demonstrate adding an integration test (API test) to your serverless project.

The Tech Stack: NodeJS, Jest, Serverless Framework, and the Serverless offline plugin.

The test going to cover the /search route from my [devresorces](https://www.devresources.site/) project.

To test a route when you develop a serverless function you usually going to use the offline plugin to run the function locally and test the endpoint.

Let's add Jest to the project this is simple as that:

```bash
npm i -D jest
```

Now let's create the test folder and our first test file inside /tests/search.test.js

```bash
//search.test.js
jest.setTimeout(30000); // incease jest timeout to 30s
const rp = require('request-promise'); // http library to create the http call
const { startSlsOffline, stopSlsOffline } = require('./slsUtils'); 
// utililty to start and stop the serverless offline plugin.

const domain = 'http://localhost:3001'; //make sure to change to the port you are using

beforeAll(async () => {
  await startSlsOffline().catch(e => {
    console.error(e);
  });
});

afterAll(() => {
  stopSlsOffline();
});

test('search', async () => {
  try {
    const res = await rp.get(`${domain}/search?q=jest`);
    expect(res).toBeDefined();
    const resources = JSON.parse(res);
    expect(typeof resources).toBe('object');
    expect(resources.length).toBeDefined();
  } catch (error) {
    throw error;
  }
});
```

Basically what we are doing is running `sls offline start`  before the tests start and in the end we kill the process.

```bash
const { spawn } = require('child_process');

let slsOfflineProcess;

const finishLoading = () =>
  new Promise((resolve, reject) => {
    slsOfflineProcess.stdout.on('data', data => {
      if (data.includes('Offline listening on')) {
        console.log(data.toString().trim());
        console.log(`Serverless: Offline started with PID : ${slsOfflineProcess.pid}`);
        resolve('ok');
      }

      if (data.includes('address already in use')) {
        reject(data.toString().trim());
      }
    });

    slsOfflineProcess.stderr.on('data', errData => {
      console.log(`Error starting Serverless Offline:\n${errData}`);
      reject(errData);
    });
  });

function startSlsOffline() {
  const cmdArr = 'offline start --skipCacheInvalidation --port 3001 --stage dev'.split(' ');
  slsOfflineProcess = spawn('sls', cmdArr, { shell: true, cwd: process.cwd() });

  return finishLoading();
}

function stopSlsOffline() {
  slsOfflineProcess.stdin.write('q\n');
  slsOfflineProcess.stdin.pause();
  slsOfflineProcess.kill();

  console.log('Serverless Offline stopped');
}

module.exports = {
  stopSlsOffline,
  startSlsOffline
};
```

If you going to create many test files make sure to move the beforeAll and afterAll to the global config file.

You can also run this test in your CI.

feel free to contact me for more details :)
