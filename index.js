#!/usr/bin/env node

/**
 * SETUP
 */

// Global modules
const log = require('yalm')
const mqtt = require('mqtt')
const dgram = require('dgram')
//const request = require('request')//depricated!!
const axios = require('axios');
const encodeurl = require('encodeurl')

const pkg = require('./package.json')
const cfg = require(process.argv[2] || './config.json')

log.setLevel(cfg.log)
log.info(pkg.name + ' ' + pkg.version + ' starting')

/**
 * SETUP MQTT
 */

let mqttConnected

const mqttClient = mqtt.connect(
    cfg.mqtt.url, {
        will: { topic: cfg.mqtt.name + '/connected', payload: '0', retain: true },
        rejectUnauthorized: cfg.mqtt.secure
    }
)

mqttClient.on('connect', () => {

    mqttClient.publish(cfg.mqtt.name + '/connected', '2', { retain: true })

    mqttConnected = true
    log.info('mqtt: connected ' + cfg.mqtt.url)

    //mqttClient.subscribe(cfg.mqtt.name + '/set/#')

    for (const subscriptionKey in cfg.loxone.subscriptions) {
        mqttClient.subscribe(cfg.loxone.subscriptions[subscriptionKey])
        log.info('mqtt: subscribed to ' + cfg.loxone.subscriptions[subscriptionKey])
    }
})

mqttClient.on('close', () => {

    if (mqttConnected) {
        mqttConnected = false
        log.info('mqtt: disconnected ' + cfg.mqtt.url)
    }
})

mqttClient.on('error', err => {

    log.error('mqtt: error ' + err.message)
})

mqttClient.on('message', (topic, payload, msg) => {

    //enable for debugging purposes
    //log.info('mqtt: message ' + topic + ' ' + payload.toString())

    //discard info messages
    if(((topic.includes('/stat/') || topic.includes('/connected')) == false) && (topic.includes('/tele/') == false || ((topic.includes('/tele/') == true) && (topic.includes('/RFBridge1/') == true))))
    {
        log.info('mqtt: message ' + topic + ' ' + payload.toString())

        log.info('mqtt: testing payload');

        const payloadString = payload.toString()
        
        //check if we received something of the RFbridge
        if(topic.includes("RFBridge1")){
            //get the RfReceived object its Data property
            try {
                payload = JSON.parse(payloadString);
                let Datanode = payload.RfReceived.Data.toString();
                topic = 'loxone/' + Datanode + '/cmnd/POWER';
                payload = {
                    val: 1,
                    name: 'unknown'
                }
                setTimeout(sendPowerOffMQTT, 5000, Datanode);
            } catch (error) {
                        log.info('Could not parse RFBridge playload!');
                        return;
                        log.info('went out of the program!');
                    }   
        }
        else
        {
            // Try to parse the payload. If not possible, add null as payload.
            if (!isNaN(payloadString)) {
                payload = {
                    val: Number(payloadString),
                    name: 'unknown'
                }
            } else {
                //If the payload contains Tasmota [ON,OFF] values change them to numeric values so we can use them as an analog value inside loxone.
                if(payloadString == 'ON')
                {
                    log.info('mqtt: payload ON is converted to 1');
                    payload = {
                        val: 1,
                        name: 'unknown'
                    }
                } else if(payloadString == 'OFF') {
                    log.info('mqtt: payload OFF is converted to 0');
                        payload = {
                        val: 0,
                            name: 'unknown'
                        }
                } else {
                        try {
                            payload = JSON.parse(payloadString)
                        } catch (error) {
                            payload = {
                                val: null,
                                name: 'unknown'
                            }
                        }   
                }
            }
        }

        // Use the udp datagram api for non-text like bool, number, null.
        if (typeof (payload.val) !== 'string') {

            let message = topic
            if (payload.val != null) {
                message += '=' + payload.val
            }

            log.info('udp client: send datagram ' + message)

            const udpClient = dgram.createSocket('udp4')
            udpClient.send(message, cfg.loxone.port, cfg.loxone.host, (error) => {
                if (error) {
                    log.error('udp client error: ' + error)
                }
                udpClient.close()
            })
        }

        // Use http, if the payload is a text value.
        if (typeof (payload.val) === 'string') {

            const url = encodeurl('http://' + cfg.loxone.username + ':' + cfg.loxone.password + '@' + cfg.loxone.host + '/dev/sps/io/' + payload.name + '/' + payload.val)

            log.info('http client: invoke request http://' + cfg.loxone.host + '/dev/sps/io/' + payload.name + '/' + payload.val)

            request(url, (error, response, body) => {
                if (error) {
                    log.error('http client error: ' + error)
                }
            })

            axios.get(url)
                .then(res => {
                    //do nothing
                    log.info(`statusCode: ${res.status}`);
                    //console.log(res);
                })
                .catch(error => {
                    log.error('http client error: ' + error)
                });
        }
    }
})

/**
 * Auto Power off functions
 * Mainly used for motions sensors
 */

function sendPowerOffMQTT(datanode) {
    let message = 'loxone/' + datanode + '/cmnd/POWER';
    let payload = {
                val: 0,
                name: 'unknown'
            }
    log.info('udp client: send automated OFF datagram ' + message)

    const udpClient = dgram.createSocket('udp4')
    udpClient.send(message, cfg.loxone.port, cfg.loxone.host, (error) => {
        if (error) {
            log.error('udp client error: ' + error)
        }
        udpClient.close()
     })
}


/**
 * UDP SERVER
 */

const udpServer = dgram.createSocket('udp4')

udpServer.on('listening', () => {

    log.info('udp server: listen on udp://' + udpServer.address().address + ':' + udpServer.address().port)
})

udpServer.on('close', () => {

    log.info('udp server: closed')
})

udpServer.on('message', (message, remote) => {

    message = message.toString().trim()

    log.info('udp server: message from udp://' + remote.address + ':' + remote.port + ' => ' + message)

    let messageParts = message.split(';')

    // Check if the message was send by the logger or by the UDP virtual output
    // and concatenate the array if it's the logger
    const regexLogger = /^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2};.*$/g
    if (message.match(regexLogger) != null) {
        messageParts = messageParts.splice(2)
    }

    // Define topic. This must be in the udp message
    const topic = messageParts[0]

    // Define value. Can be null or empty
    let value = ''
    if (messageParts.length > 1) {
        value = messageParts[1]
    }

    // Define the mqtt qos. Default is 0
    let qos = 0
    if (messageParts.length > 2) {
        qos = parseInt(messageParts[2])
    }

    // Define the mqtt retain. Default is false
    let retain = false
    if (messageParts.length > 3) {
        retain = messageParts[3] === 'true'
    }

    // Define the optional name payload string. Default is not defined
    let name = null
    if (messageParts.length > 4) {
        name = messageParts[4]
    }

    // Add the default prefix if the custom prefix is not specified
    let mode = 'json'
    if (messageParts.length > 5) {
        mode = messageParts[5]
    }

    // Parse the value, to publish the correct format
    let parsedValue
    if (value === '') {
        parsedValue = ''
    } else if (value === 'true') {
        parsedValue = 1
    } else if (value === 'false') {
        parsedValue = 0
    } else if (!isNaN(value)) {
        parsedValue = Number(value)
    } else {
        parsedValue = value
    }

    // Prepare the payload object with timestamp, value and optionally the name
    let payload = parsedValue
    if (mode === 'json') {
        payload = {
            ts: Date.now(),
            val: parsedValue
        }
        if (name !== null) {
            payload.name = name
        }
        payload = JSON.stringify(payload)
    }

    mqttClient.publish(topic, payload, { qos: qos, retain: retain })
    log.info('mqtt: publish ' + topic + ' ' + payload)
})

udpServer.on('error', (err) => {

    log.error(err)
})

udpServer.bind(cfg.loxone.port)
