/**
 * Copyright 2013, 2016 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

"use strict";
const miio = require('miio');

module.exports = function(RED) {

    function RoborockNodeEvent(config) {

        var node = this;
        RED.nodes.createNode(node, config);
        node.connection = RED.nodes.getNode(config.connection);
        node.config = config;

        node.status({
            fill: 'red',
            shape: 'ring',
            text: 'disconnected'
        });

        if (!node.connection) return;

        miio.device({
                address: node.connection.host,
                token: node.connection.token
            })
            .then(device => {
                node.device = device;
                node.device.updatePollDuration(node.config.polling * 1000);
                node.device.updateMaxPollFailures(0);

                node.device.on('thing:initialized', () => {
                    sendDebug('initialized');
                    node.status({
                        fill: 'green',
                        shape: 'dot',
                        text: 'connected'
                    });
                });

                node.device.on('thing:destroyed', () => {
                    sendDebug('destroyed');
                    node.status({
                        fill: 'red',
                        shape: 'ring',
                        text: 'disconnected'
                    });
                    if(node.device) {
                        node.device.init();
                    }
                });

                if (node.config.pollingStatus) {
                    node.inteval = setInterval(() => {
                        sendDebug('polling status');
                        device.call('get_status')
                            .then(status => {
                                delete(status[0].msg_seq);
                                var jsonStatus = JSON.stringify(status[0]);
                                if (jsonStatus !== node.lastStatus) {
                                    node.lastStatus = jsonStatus;
                                    node.send({
                                        payload: {
                                            status: status[0]
                                        },
                                        status: status[0]
                                    });
                                }
                            })
                            .catch(err => {

                            });
                    }, node.config.polling * 1000);
                }

                node.device.onAny(event => {
                    if (event === "stateChanged") {
                        sendDebug('polling state');
                        node.device.state()
                            .then(state => {
                                var jsonState = JSON.stringify(state);
                                if (jsonState !== node.lastState) {
                                    node.lastState = jsonState;
                                    node.send({
                                        payload: {
                                            state: state
                                        },
                                        state: state
                                    });
                                }
                            });
                    }
                    if (node.config.events) {
                        node.send({
                            payload: {
                                event: event
                            },
                            event: event
                        });
                    }
                });
            })
            .catch(err => {
                node.warn('Encountered an error while connecting to device: ' + err.message);
                node.status({
                    fill: 'red',
                    shape: 'ring',
                    text: 'disconnected'
                });
            });

        node.on('close', () => {
            sendDebug('close');
            clearInterval(node.inteval);
            node.device.destroy();
            delete(node.device);
        });

        function sendDebug(data) {

            if (!node.config.debug) return;
            let msg = {
                id: node.id,
                name: node.name,
                topic: 'Roborock',
                property: 'debug',
                msg: data,
                _path: ''
            }
            msg = RED.util.encodeObject(msg, {
                maxLength: 1000
            });
            RED.comms.publish('debug', msg);
        }
    }

    RED.nodes.registerType('roborockEvent', RoborockNodeEvent);
}
