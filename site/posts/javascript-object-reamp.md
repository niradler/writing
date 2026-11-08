---
title: Javascript object reamp
description: 'in my daily job as a full stack js developer I often need to manipulate js objects, either remove fields or transform to a new structure etc. I decided to…'
publishedAt: '2020-02-11T09:59:30.000Z'
updatedAt: '2022-12-02T14:17:37.365Z'
tags:
  - js
  - npm
  - tools
sourceUrl: 'https://blog.niradler.com/javascript-object-reamp'
originalUrl: 'https://blog.niradler.com/javascript-object-reamp'
sourceMarkdown: 'https://blog.niradler.com/javascript-object-reamp.md'
series: Open source
seriesSlug: open-source
cover: /media/javascript-object-reamp/cover.jpeg
coverAlt: Javascript object reamp
---
# Javascript object reamp

in my daily job as a full stack js developer I often need to manipulate js objects, either remove fields or transform to a new structure etc.

I decided to create an npm module [object-remap](https://github.com/niradler/object-remap), to make this repeated task more reliable, reduce code, and create cleaner code.

let's look at the examples:

```javascript
const objectRemap = require("object-remap");

const obj = {
  a: 1,
  b: 2,
  c: 3,
  d: {
    e: 4,
    f: [1, 2, 3]
  }
};

//simple usage
const fields = ["a", "b", "c"];

let newObj = objectRemap(obj, fields);
console.log({ obj, newObj });
/*
{
  obj: { a: 1, b: 2, c: 3, d: { e: 4, f: [Array] } },
  newObj: { a: 1, b: 2, c: 3}
}
*/

//advance usage
const fieldsMap = [
  {
    origin: "a",
    target: "a"
  },
  {
    origin: "d.e",
    target: "e"
  },
  {
    origin: "d.f",
    target: "f",
    formatter: data => `${data.length} items`
  }
];

newObj = objectRemap(obj, fieldsMap);
console.log({ obj, newObj });
/*
{ 
  obj: { a: 1, b: 2, c: 3, d: { e: 4, f: [Array] } },
  newObj: { a: 1, e: 4, f: '3 items' } 
}
*/
```

for getting started install the package with npm:

```bash
npm i -S object-remap
```
