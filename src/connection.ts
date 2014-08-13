﻿import events = require('events');
import websocket = require('websocket');
import connectionManager = require("./connection-manager");
import protocol = require('./protocol');

export interface API {
    address: string;
    connected(remoteId: string): void;
    disconnected(remoteId: string): void;
    relay(remoteId: string, message: string): void;
    relayed(remoteId: string, message: string): void;
    on(event: string, listener: Function): events.EventEmitter;
    removeListener(event: string, listener: Function): events.EventEmitter;
}

export class Connection {
    public address: string;
    private emitter: events.EventEmitter;
    private peers: connectionManager.ConnectionManager;
    private connection: websocket.connection;

    constructor(address: string, peers: connectionManager.ConnectionManager, connection: websocket.connection) {
        this.address = address;
        this.peers = peers;
        this.connection = connection;
        this.emitter = new events.EventEmitter();

        connection.on('message', this.messageHandler.bind(this));
        connection.on('close', this.closeHandler.bind(this));
    }

    static create(address: string, peers: connectionManager.ConnectionManager, raw: websocket.connection): API {
        var intance = new Connection(address, peers, raw);
        return intance.getApi();
    }

    private getApi(): API {
        return {
            address: this.address,
            connected: this.connected.bind(this),
            disconnected: this.disconnected.bind(this),
            relay: this.relay.bind(this),
            relayed: this.relayed.bind(this),
            on: this.emitter.on.bind(this.emitter),
            removeListener: this.emitter.removeListener.bind(this.emitter)
        };
    }

    private messageHandler(raw: websocket.IMessage) {
        console.log('message', raw);

        if (raw.type === "utf8") {
            var message = protocol.parse(JSON.parse(raw.utf8Data));

            switch (message.type) {
                case protocol.MESSAGE_TYPE_RELAY:
                    this.relayHandler(
                        (<protocol.RelayMessage>message).peerId,
                        (<protocol.RelayMessage>message).content
                        );
                    break;
            }
        }
    }

    private closeHandler() {
        this.emitter.emit('close');
    }

    private sendProtocolMessage(message: protocol.Message) {
        var stringified = JSON.stringify(message.getData);
        this.connection.sendUTF(stringified);
    }

    private relayHandler(destination: string, message: string) {
        var peer = this.peers.get(destination);
        if (!peer) return;

        peer.relayed(this.address, message);
    }

    public connected(remoteId: string) {
        this.sendProtocolMessage(protocol.connected(remoteId));
    }

    public disconnected(remoteId: string) {
        this.sendProtocolMessage(protocol.disconnected(remoteId));
    }

    private relay(remoteId: string, message: string) {
        this.sendProtocolMessage(protocol.relay(remoteId, message));
    }

    private relayed(remoteId: string, message: string) {
        this.sendProtocolMessage(protocol.relayed(remoteId, message));
    }
}

