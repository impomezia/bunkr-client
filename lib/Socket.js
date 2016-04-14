'use strict';

const EventEmitter = require('events').EventEmitter;
const SockJS       = require('sockjs-client');
const util         = require('util');
const sjmp         = require('./utils/sjmp');
const shortid      = require('./utils/shortid');


class Socket extends EventEmitter {
  constructor(url) {
    super();

    this._url     = url;
    this._sockjs  = null;
    this._timeout = null;
  }


  connect(url) {
    if (this.isReady()) {
      return;
    }

    this._url = url || this._url;

    this._sockjs = new SockJS(this._url);
    this._sockjs.onopen      = this._onOpen.bind(this);
    this._sockjs.onmessage   = this._onMessage.bind(this);
    this._sockjs.onclose     = this._onClose.bind(this);
    this._sockjs.onheartbeat = this._onHeartbeat.bind(this);

    this._refresh();
  }


  close() {
    if (!this._sockjs) {
      return;
    }

    this._sockjs.close();
    this._clearTimeout();
  }


  send(packet) {
    if (!this.isReady()) {
      throw new Error('client not ready');
    }

    if (!packet.id) {
      packet.id = shortid.generate();
    }

    if (this._sockjs.send(sjmp.serialize(packet, true))) {
      this.emit('sent', packet);
    }
  }


  write(packet) {
    if (!this.isReady()) {
      return false;
    }

    this._sockjs.send(packet);
    return true;
  }


  isReady() {
    return !!this._sockjs;
  }


  _onMessage(event) {
    this._refresh();

    const packet = sjmp.deserialize(event.data);
    if (packet) {
      this.emit('packet', packet);
    }
  }


  _onOpen() {
    this._refresh();
    this.emit('open', this._sockjs.protocol);
  }


  _onClose(event) {
    this._cleanup();
    this.emit('close', event);
  }


  _onHeartbeat() {
    this._sockjs.send('');
    this._refresh();
  }


  _clearTimeout() {
    clearTimeout(this._timeout);
    this._timeout = null;
  }


  _cleanup() {
    this._clearTimeout();

    if (!this._sockjs) {
      return;
    }

    this._sockjs.onopen      = null;
    this._sockjs.onmessage   = null;
    this._sockjs.onclose     = null;
    this._sockjs.onheartbeat = null;
    this._sockjs             = null;
  }


  _refresh() {
    clearTimeout(this._timeout);
    this._timeout = setTimeout(this.close.bind(this), 35000);
  }
}

module.exports = Socket;
