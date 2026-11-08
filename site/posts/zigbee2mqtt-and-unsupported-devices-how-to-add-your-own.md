---
title: 'Zigbee2MQTT and Unsupported Devices: How to Add Your Own'
description: 'Zigbee2MQTT and Unsupported Devices: How to Add Your Own'
publishedAt: '2023-12-11T22:00:00.000Z'
updatedAt: '2023-12-11T22:00:00.000Z'
tags:
  - home-assistant
  - zigbee
  - zigbee2mqtt
sourceUrl: 'https://blog.niradler.com/zigbee2mqtt-and-unsupported-devices-how-to-add-your-own'
originalUrl: 'https://blog.niradler.com/zigbee2mqtt-and-unsupported-devices-how-to-add-your-own'
sourceMarkdown: 'https://blog.niradler.com/zigbee2mqtt-and-unsupported-devices-how-to-add-your-own.md'
series: Open source
seriesSlug: open-source
cover: /media/zigbee2mqtt-and-unsupported-devices-how-to-add-your-own/cover.jpeg
coverAlt: 'Zigbee2MQTT and Unsupported Devices: How to Add Your Own'
---
# Zigbee2MQTT and Unsupported Devices: How to Add Your Own

Zigbee2MQTT is an excellent open-source project that allows you to create a Zigbee gateway and integrate various devices into your smart home ecosystem. While many devices are supported out of the box, there may be instances where a specific device isn't officially recognized. In this guide, we'll walk you through the process of adding support for the **Gledopto GL-LB-001P RGB+CCT LED bar** to Zigbee2MQTT using **zigbee-herdsman-converters**.

## Check Device Compatibility

Before proceeding, check if your device is already supported in the **Zigbee2MQTT development branch** by searching for your Zigbee model in the project's repository.

---

## 1\. Pairing the Device with Zigbee2MQTT

The first step is to pair your device with Zigbee2MQTT:

1. Put the **GL-LB-001P** into pairing mode (usually done by performing a factory reset).
    
2. Ensure that joining is enabled in your **Zigbee2MQTT** configuration.
    
3. Once paired, you will see a log message indicating that the device has been detected but is not yet supported:
    

```plaintext
Zigbee2MQTT:info 2019-11-09T12:19:56: Successfully interviewed '0x00158d0001dc126a', device has successfully been paired.
Zigbee2MQTT:warn 2019-11-09T12:19:56: Device '0x00158d0001dc126a' with Zigbee model 'lumi.sens' and manufacturer name 'some_name' is NOT supported.
```

---

## 2\. Adding Support for Your Device

To add support, create an **external converter file** named `GLEDOPTO.js` inside your Zigbee2MQTT folder. This file will define how Zigbee2MQTT should communicate with your device.

### Sample `GLEDOPTO.js` Converter

```javascript
const fz = require('zigbee-herdsman-converters/converters/fromZigbee');
const tz = require('zigbee-herdsman-converters/converters/toZigbee');
const extend = require('zigbee-herdsman-converters/lib/extend');
const exposes = require('zigbee-herdsman-converters/lib/exposes');
const e = exposes.presets;

const light_onoff_brightness_colortemp_color = (options = {}) => ({
    ...extend.light_onoff_brightness_colortemp_color({
        disablePowerOnBehavior: true,
        supportsHueAndSaturation: true,
        ...options,
    }),
    toZigbee: [
        tz.gledopto_light_onoff_brightness,
        tz.gledopto_light_color_colortemp,
    ],
});

const definition = {
    zigbeeModel: ['GL-LB-001P'],
    model: 'GL-LB-001P',
    vendor: 'Gledopto',
    description: 'Zigbee USB LED bar RGB+CCT (pro)',
    extend: light_onoff_brightness_colortemp_color({
        colorTempRange: [158, 495],
        disablePowerOnBehavior: false,
    }),
};

module.exports = definition;
```

---

## 3\. Updating Your Zigbee2MQTT Configuration

After creating the `GLEDOPTO.js` file, update your Zigbee2MQTT configuration:

1. **Restart Zigbee2MQTT** for the new converter to be recognized.
    
    * If using Home Assistant:
        
        * Go to **Supervisor** &gt; **Add-ons** &gt; **Zigbee2MQTT**.
            
        * Click **Restart**.
            
    * If running Zigbee2MQTT manually, restart the service using:
        
        ```sh
        systemctl restart zigbee2mqtt
        ```
        

---

## 4\. Pair and Control Your Gledopto GL-LB-001P

Once Zigbee2MQTT restarts, reattempt pairing. Your **Gledopto GL-LB-001P** should now be recognized and fully controllable through Zigbee2MQTT.

---

## Conclusion

Adding support for **unsupported Zigbee devices** like the **Gledopto GL-LB-001P** might seem complex, but with the right approach, you can expand your smart home capabilities. By following this guide, you've successfully integrated your **RGB+CCT LED bar** into Zigbee2MQTT.

Happy tinkering!
