# mqtt2loxone

[![mqtt-smarthome](https://img.shields.io/badge/mqtt-smarthome-blue.svg?style=flat-square)](https://github.com/mqtt-smarthome/mqtt-smarthome)
[[npm](https://img.shields.io/npm/v/mqtt2loxone.svg?style=flat-square)](https//www.npmjs.com/package/mqtt2loxone)
[![travis](https://img.shields.io/travis/claudiospizzi/mqtt2loxone.svg?style=flat-square)](https://travis-ci.org/claudiospizzi/mqtt2loxone)

This node.js application is a bridge between the [Loxone Smart Home] and a mqtt
broker. The Loxone MiniServer can publish a message by using the UDP virtual
output and using port 4000 on mqtt2loxone by default. The mqtt2loxone will
**publish** the message afterwards to the mqtt broker.

On the other way, the mqtt2loxone will **subscribe** to the topic `loxone/set/#`
and forward all messages received from the mqtt broker to the Loxone MiniServer.
The mqtt2loxone will check the `val` property. If the property is a string, it
will be forwarded to a Loxone virtual text input. If it's a number, boolean or
null, it will be forwarded to a Loxone UDP virtual input, using the same port
4000 by default.

## Installation

This node.js application is installed from the npm repository and executed with
the node command.

```bash
npm install -g mqtt2loxone
node /usr/local/bin/mqtt2loxone
```

Alternatively, the module can be executed as a docker container. Use the
following Dockerfile to build a container injecting the config file.

```dockerfile
FROM node:alpine

RUN npm install -g mqtt2loxone

COPY config.json /etc/mqtt2loxone.json

ENTRYPOINT [ "/usr/local/bin/mqtt2loxone", "/etc/mqtt2loxone.json" ]
```

## Configuration

The following configuration file is an example. Please replace the desired
values like the mqtt url and add your loxone ip address, username and password.

```json
{
    "log": "debug",
    "mqtt": {
        "url": "mqtt://192.168.1.10",
        "name": "loxone",
        "secure": false
    },
    "loxone": {
        "host": "192.168.1.20",
        "port": 4000,
        "username": "user",
        "password": "pass"
    }
}
```

## API

### UDP Virtual Output

This module contains a udp api to receive udp datagram packages from the Loxone
MiniServer. The virtual output must be configured with the address pointing to
the ip address of mqtt2loxone and the specified port. Also remove the `;`
separator in the virtual output.

![UDP Virtual Output](https://github.com/claudiospizzi/mqtt2loxone/blob/master/assets/loxone-virtualoutput.png?raw=true)

Within the virtual output, a virtual output command can be created to specify
what will be send to the mqtt broker. Please use the option digital output. For
the field `Command On` specify the mqtt command in the following format:

* `<topic>;<value>;<qos>;<retain>`

![UDP Virtual Output Command](https://github.com/claudiospizzi/mqtt2loxone/blob/master/assets/loxone-virtualoutputcommand.png?raw=true)

By the way, you can also use the logger component in loxone with the UDP target
to log change or status messages to mqtt.

### UDP Virtual Input

tbd

### Virtual Text Input

tbd

[Loxone Smart Home]: https://www.loxone.com/
