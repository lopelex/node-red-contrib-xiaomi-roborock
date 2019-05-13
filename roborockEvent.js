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

        if (!node.connection) return;

        node.status({
            fill:'red',
            shape:'ring',
            text:'disconnected'
        });

        createDevice();

        function createDevice() {

            sendDebug('Connect to roborock');

            if (node.device) {
                node.device.destroy();
                delete(node.device);
                delete(node.socket);
            }

            miio.device({
                    address: node.connection.host,
                    token: node.connection.token
                })
                .then(device => {
                    node.device = device;
                    node.device.updatePollDuration(node.config.pooling * 1000);
                    node.device.on('stateChanged', getState);

                    node.status({
                        fill:'green',
                        shape:'dot',
                        text:'connected'
                    });

                    if (node.config.events) {
                        node.device.onAny(event => {
                            sendDebug(event);
                            node.send({
                                payload: {
                                    event: event
                                },
                                event: event
                            });
                        });
                    }

                    try {

                        node.socket = node.device.handle.api.parent.socket;
                        node.socket.on('close', () => {
                            sendDebug('Connection closed');
                            node.status({
                                fill:'red',
                                shape:'ring',
                                text:'disconnected'
                            });
                            createDevice();
                        });
                        node.socket.on('error', () => {
                            sendDebug('Connection error');
                            node.status({
                                fill:'red',
                                shape:'ring',
                                text:'disconnected'
                            });
                            createDevice();
                        });
                        node.socket.on('message', (msg, rinfo) => {
                            sendDebug('Connection message')
                        });
                    } catch (err) {
                        node.warn('catch:' + err);
                        node.status({
                            fill:'red',
                            shape:'ring',
                            text:'disconnected'
                        });
                    }
                })
                .catch(err => {
                    node.warn('Encountered an error while connecting to device: ' + err.message);
                    node.status({
                        fill:'red',
                        shape:'ring',
                        text:'disconnected'
                    });
                });
        }

        function getState() {

            node.device.state()
                .then(state => {
                    var jsonState = JSON.stringify(state);
                    if (jsonState !== node.lastState) {
                        node.lastState = JSON.stringify(state);
                        sendDebug(state);
                        node.send({
                            payload: {
                                state: state
                            },
                            state: state
                        });
                    }
                });
        }

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
