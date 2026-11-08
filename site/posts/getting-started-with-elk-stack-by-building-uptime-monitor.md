---
title: Getting Started With ELK Stack By Building Uptime Monitor.
description: 'What is ELK? long story short, ELK stand for Elasticsearch, Logstash, Kibana. Elasticsearch is a full-text, distributed NoSQL database. Logstash is a tool…'
publishedAt: '2018-12-05T23:20:39.000Z'
updatedAt: '2018-12-05T23:20:39.000Z'
tags:
  - kibana
  - elk
  - elasticsearch
sourceUrl: 'https://blog.niradler.com/getting-started-with-elk-stack-by-building-uptime-monitor'
originalUrl: 'https://niradler.com/getting-started-with-elk-stack/'
sourceMarkdown: 'https://blog.niradler.com/getting-started-with-elk-stack-by-building-uptime-monitor.md'
cover: /media/getting-started-with-elk-stack-by-building-uptime-monitor/cover.png
coverAlt: Getting Started With ELK Stack By Building Uptime Monitor.
---
# Getting Started With ELK Stack By Building Uptime Monitor.

What is ELK? long story short, ELK stand for ***Elasticsearch***, ***Logstash***, ***Kibana***.

[***Elasticsearch***](https://www.elastic.co/products/elasticsearch) is a full-text, distributed NoSQL database.

[Logstash](https://www.elastic.co/products/logstash) is a tool for collecting, parsing and storing logs for future use.

[***Kibana***](https://www.elastic.co/products/kibana) is an open-source analytics and visualization platform designed to work with Elasticsearch.

<figure class="media" data-align="left">
<img src="/media/getting-started-with-elk-stack-by-building-uptime-monitor/3JKSx-S8V.png" alt="Getting Started With ELK Stack By Building Uptime Monitor." loading="lazy" decoding="async" data-align="left">
</figure>

There is one more tool or tools I want to mention:

[Beats](https://www.elastic.co/products/beats) a\_ll kinds of shippers for all kinds of data (later on we are going to use [Heartbeat](https://www.elastic.co/products/beats/heartbeat) from the beats family).

ELK  stack can be overwhelming so I suggest we start with setup an environment and continue from that.

Quick setup with docker:

```bash
git clone https://github.com/niradler/docker-elk
cd docker-elk
docker-compose -f "docker-compose.yml" up
```

let's see what we got:

```bash
docker ps
```

<figure class="media" data-align="left">
<img src="/media/getting-started-with-elk-stack-by-building-uptime-monitor/4YQuBnQzs.png" alt="Getting Started With ELK Stack By Building Uptime Monitor." loading="lazy" decoding="async" data-align="left">
</figure>

After docker-compose finish, we get 4 containers up, Kibana, Elasticsearch, Logstash and Heartbeat.

The purpose of the Elk stack is to store, analyze, and visualise data, so let's create data to work with, for that, I'm going to use [Heartbeat](https://www.elastic.co/products/beats/heartbeat) (i choose this one only because it is simple to understand and very useful).

[*Heartbeat*](https://www.elastic.co/products/beats/heartbeat) monitor services for their availability with active probing.

in the heartbeat folder, you can find the heartbeat.yml

<figure class="media" data-align="left">
<img src="/media/getting-started-with-elk-stack-by-building-uptime-monitor/HpJumHmPD.png" alt="Getting Started With ELK Stack By Building Uptime Monitor." loading="lazy" decoding="async" data-align="left">
</figure>

in this example I'm going to use heartbeat to call Elasticsearch root every 20s, google every 40s, and a random website every 40s, and of-course to report the result to Elasticsearch.

now let's open Kibana [http://localhost:5601](http://localhost:5601) and go to the management tab, choose [Index Patterns](http://localhost:5601/app/kibana#/management/kibana/indices/) and enter the index: heartbeat-\*, press next and choose timestamp.

now we can go to the discover tab and get amazed.

<figure class="media" data-align="left">
<img src="/media/getting-started-with-elk-stack-by-building-uptime-monitor/mqiyLPJUC.png" alt="Getting Started With ELK Stack By Building Uptime Monitor." loading="lazy" decoding="async" data-align="left">
</figure>

Notes:

*   Press the options button and turn on query features
    
*   Press the auto-refresh button and configure it to keep updating the data
    
*   Choose the field to show by hovering them in the side menu and press add
    
*   Search with monitor.status:up
    

let's move on to the [Visualize](http://localhost:5601/app/kibana#/visualize) tab, press the plus button and choose pie, on the left choose the index we created earlier, now let's visualize the statuses we get from heartbeat, press **Split Slices** and fill:

*   Aggregation -&gt; Terms
    
*   Field -&gt; monitor.status
    

Press the play button and you get:

<figure class="media" data-align="left">
<img src="/media/getting-started-with-elk-stack-by-building-uptime-monitor/diOfqE7ds.png" alt="Getting Started With ELK Stack By Building Uptime Monitor." loading="lazy" decoding="async" data-align="left">
</figure>

you can hover it to see the count, when you are satisfied with the result press the save button on the top and enter a name for the chart.

Notes and resources:

*   watch these official elastic videos: [Elasticsearch](https://www.elastic.co/webinars/getting-started-elasticsearch), [Kibana](https://www.elastic.co/webinars/getting-started-kibana), [Logstash](https://www.elastic.co/webinars/getting-started-logstash)
    
*   logz.io have lots of good examples and they are free to experiment with up to 3GB.
    
*   to experiment with Elasticsearch you can use the Dev Tools in Kibana.
