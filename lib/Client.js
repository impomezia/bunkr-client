'use strict';

const _            = require('lodash');
const Promise      = require('bluebird');
const fetch        = require('node-fetch');
const EventEmitter = require('events').EventEmitter;
const Socket       = require('./Socket');
const keys         = require('./keys');
const shortid      = require('./utils/shortid');
const sjmp         = require('./utils/sjmp');


fetch.Promise = Promise;


class Client extends EventEmitter {
  constructor(url, access_token) {
    super();

    this.url          = url;
    this.access_token = access_token;
    this.socket       = new Socket();
    this.state        = keys.CLIENT_STATE_CONNECTING;
    this.layout       = null;
    this.timeout      = undefined;
    this.account_id   = null;
    this.callbacks    = new Map();
    this.onfly        = new Map();
    this.pending      = [];

    this.stats = {
      open:         0,
      sent:         0,
      offline_sent: 0,
      onfly_saves:  0,
      received:     0
    };

    this.socket.on('open',   this._onOpen.bind(this));
    this.socket.on('close',  this._onClose.bind(this));
    this.socket.on('packet', this._onPacket.bind(this));
  }


  /**
   * Connect to server.
   *
   * @returns {Promise}
   */
  connect() {
    clearTimeout(this.timeout);
    if (this.socket.isReady()) {
      return Promise.resolve(this);
    }

    this._setState(keys.CLIENT_STATE_CONNECTING);

    return this._getLayout()
      .then(layout => {
        this.socket.connect(layout.socket[0]);

        return new Promise((resolve, reject) => {
          this.once(keys.CLIENT_OPEN, event => {
            resolve(this);
          });

          this.once(keys.CLIENT_ERROR, event => {
            reject(event);
          });
        })
      });
  }


  /**
   * Perform "get" request.
   *
   * @param {String} resource
   * @param {*}      [body]
   * @param {Object} [options]
   * @returns {Promise}
   */
  get(resource, body, options) {
    return this.fetch('get', resource, body, options);
  }


  /**
   * Perform "search" request.
   *
   * @param {String} resource
   * @param {*}      [body]
   * @param {Object} [options]
   * @returns {Promise}
   */
  search(resource, body, options) {
    return this.fetch('search', resource, body, options);
  }


  /**
   * Perform "post" request.
   *
   * @param {String} resource
   * @param {*}      [body]
   * @param {Object} [options]
   * @returns {Promise}
   */
  post(resource, body, options) {
    return this.fetch('post', resource, body, options);
  }


  /**
   * Perform "put" request.
   *
   * @param {String} resource
   * @param {*}      [body]
   * @param {Object} [options]
   * @returns {Promise}
   */
  put(resource, body, options) {
    return this.fetch('put', resource, body, options);
  }


  /**
   * Perform "delete" request.
   *
   * @param {String} resource
   * @param {*}      [body]
   * @param {Object} [options]
   * @returns {Promise}
   */
  delete(resource, body, options) {
    return this.fetch('delete', resource, body, options);
  }


  /**
   * Perform request.
   *
   * @param {String} method
   * @param {String} resource
   * @param {*}      [body]
   * @param {Object} [options]
   * @param {Number} [options.date]
   * @param {Object} [options.headers]
   * @returns {Promise}
   */
  fetch(method, resource, body, options) {
    options = options || {};

    return this.send({
      type:     '<',
      method:   method,
      resource: resource,
      date:     options.date    || 0,
      headers:  options.headers || {},
      body:     body            || null
    });
  }


  send(packet) {
    if (!packet.id) {
      packet.id = shortid.generate();
    }

    const data = sjmp.serialize(packet);
    if (!data) {
      return Promise.reject(new Error('bad_packet'));
    }

    if (this.state !== keys.CLIENT_STATE_CONNECTED) {
      return new Promise((resolve, reject) => {
        this.stats.offline_sent++;
        this.pending.push({ data: data, callbacks: { resolve: resolve, reject: reject }});
      });
    }

    return new Promise((resolve, reject) => {
      if (this._onfly(data, { resolve: resolve, reject: reject })) {
        return;
      }

      this.socket.write(JSON.stringify(data));
      this.stats.sent++;

      this.callbacks.set(packet.id, {
        resource: packet.resource,
        callbacks: [{ resolve: resolve, reject: reject }]
      });
    });
  }


  _getLayout() {
    if (this.layout) {
      return Promise.resolve(this.layout);
    }

    return fetch(`${this.url}/layout.json`)
      .then(res => res.json())
      .then(layout => {
        this.layout = layout;
        return layout;
      });
  }


  _onOpen() {
    this.socket.once('packet', packet => {
      if (packet.status === 200 && packet.resource === 'token') {
        this.account_id = packet.body.account_id;
        this._setState(keys.CLIENT_STATE_CONNECTED);
        return;
      }

      this._setState(keys.CLIENT_STATE_DISCONNECTED);
      this.emit(keys.CLIENT_ERROR, new Error(packet.body));
    });

    //this.socket.send({type: '<', method: 'post', resource: 'token', body: this.access_token});
    this.socket.send({type: '<', method: 'post', resource: 'token', body: { access_token: this.access_token, ua: 'bunkr' }});
  }


  _onClose(event) {
    if (this.state === keys.CLIENT_STATE_CONNECTED) {
      this._setState(keys.CLIENT_STATE_CONNECTING);
      this.emit(keys.CLIENT_CLOSE);
    }

    if (this.state === keys.CLIENT_STATE_DISCONNECTED) {
      return;
    }

    this._reconnect(2000);
  }


  _onPacket(packet) {
    if (this.state != keys.CLIENT_STATE_CONNECTED) {
      return;
    }

    this.stats.received++;

    if (packet.type === '>' && this.callbacks.has(packet.id)) {
      let err = null;
      if (packet.status !== 200 && packet.status !== 204) {
        err = new Error(packet.body);
        err.status = packet.status;
      }

      const data = this.callbacks.get(packet.id);
      for (let i of data.callbacks) {
        if (err) {
          i.reject(err);
        }
        else {
          i.resolve(packet);
        }
      }

      delete this.onfly.delete(data.resource);
      delete this.callbacks.delete(packet.id);
    }

    process.nextTick(() => {
      this.emit(keys.CLIENT_PACKET, packet);
    });
  }


  _setState(state) {
    this.state = state;

    this.emit(keys.CLIENT_STATE, state);

    if (state === keys.CLIENT_STATE_CONNECTED) {
      this._sendPending();
      this.stats.open++;
      this.emit(keys.CLIENT_OPEN, {
        url:       this.socket._sockjs.url,
        transport: this.socket._sockjs.transport
      });
    }
  }


  _reconnect(time) {
    clearTimeout(this.timeout);
    this.timeout = setTimeout(this.connect.bind(this), time);
  }


  _onfly(data, callbacks) {
    if (data[0] === '<') {
      const onfly = this.onfly.get(data[1]);
      if (onfly && this.callbacks.has(onfly[2]) && compare(data, onfly)) {
        this.callbacks.get(onfly[2]).callbacks.push(callbacks);
        this.stats.onfly_saves++;
        return true;
      }

      this.onfly.set(data[1], data);
    }

    return false;


    function compare(data1, data2) {
      for (let i = 0; i < data1.length; i++) {
        if (i == 2) {
          continue;
        }

        if (!_.isEqual(data1[i], data2[i])) {
          return false;
        }
      }

      return true;
    }
  }


  _sendPending() {
    for (let i of this.pending) {
      if (this._onfly(i.data, i.callbacks)) {
        continue;
      }

      try {
        this.socket.write(JSON.stringify(i.data));
      }
      catch (err) {
        i.callbacks.reject(err);
        continue;
      }

      this.stats.sent++;

      this.callbacks.set(i.data[2], {
        resource: i.data[1],
        callbacks: [i.callbacks]
      });
    }

    this.pending = [];
  }
}


module.exports = Client;
