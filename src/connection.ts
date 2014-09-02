﻿import websocket = require('websocket');
import client = require('browser-relay-client');
import connectionManager = client.connectionManager;
import protocol = client.protocol;
import event = client.event;

export interface IdentificationData {
    authority: string;
    endpoint: string;
}

export interface RelayData {
    destination: string;
    message: any;
}

export interface API {
    endpoint: string; // readonly
    connected(remoteAddr: string): void;
    disconnected(remoteAddr: string): void;
    addroutes(routes: any): void;
    relayed(remoteAddr: string, message: string): void;
    onClose: event.Event<string>; // readonly
    onRelay: event.Event<RelayData>; // readonly
    onRoutesReceived: event.Event<any>; // readonly
}

// TODO: Add websocket subclass 

export class Connection extends protocol.Protocol implements protocol.Callbacks {
    private _endpoint: string;
    private _connection: websocket.connection;

    private _onClose: event.Event<string> = new event.Event<string>();
    private _onRelay: event.Event<RelayData> = new event.Event<RelayData>();
    private _onRoutesReceived: event.Event<any> = new event.Event<any>();

    constructor(endpoint: string, connection: websocket.connection) {
        super();

        this.setReactions(this);

        this._endpoint = endpoint;
        this._connection = connection;

        connection.on('message', this.messageHandler.bind(this));
        connection.on('close', this.closeHandler.bind(this));
    }

    static create(guid: string, endpoint: string, raw: websocket.connection): API {
        var instance = new Connection(endpoint, raw);
        instance.writeIdentification(guid, instance._endpoint);
        return instance.getApi();
    }

    private getApi(): API {
        return {
            endpoint: this._endpoint,
            connected: this.writeConnected.bind(this),
            disconnected: this.writeDisconnected.bind(this),
            addroutes: this.writeAddRoutes.bind(this),
            relayed: this.writeRelayed.bind(this),
            onClose: this._onClose,
            onRelay: this._onRelay,
            onRoutesReceived: this._onRoutesReceived,
        };
    }

    private messageHandler(raw: websocket.IMessage): void {
        if (raw.type === "utf8") {
            this.readMessageData(raw.utf8Data);
        }
    }

    public readMessageData(data: string) {
        var message = JSON.parse(data);
        console.log("<--", message);
        this.readMessage(message);
    }

    private closeHandler(): void {
        this._onClose.emit(this._endpoint);
    }

    public writeMessage(message: any): void {
        var data = JSON.stringify(message);
        console.log("-->", data);
        this._connection.sendUTF(data);
    }

    public readPeerConnectedMessage(destination: string): void {
        console.error("onramp server have nothing to do with connectivity map");
    }

    public readPeerDisconnectedMessage(destination: string): void {
        console.error("onramp server have nothing to do with connectivity map");
    }

    public readAddRoutesMessage(table: any): void {
        this._onRoutesReceived.emit(table);
    }

    public readIdentificationMessage(authority: string, endpoint: string): void {
        
    }

    public readRelayMessage(destination: string, message: any): void {
        this._onRelay.emit({
            destination: destination,
            message: message
        })
    }

    public readRelayedMessage(destination: string, message: any): void {
        console.warn("processing relayed message", message);
        var MESSAGE_TYPE = this.MESSAGE_TYPE;
        var messageType = message[0];

        switch (messageType) {
            case MESSAGE_TYPE.RELAY:
                this.readRelayMessage(message[1], message[2]);
                break;
        }	
    }
}

