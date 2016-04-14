'use strict';

var types = {
  TYPE_REQUEST:  '<',
  TYPE_REPLY:    '>',
  TYPE_MODIFIED: '=',
  TYPE_ADDED:    '+',
  TYPE_DELETED:  '-'
};


var shortcuts = {
  write: {
    post: '+',
    put: '=',
    delete: '-',
    search: '?'
  },
  read: {
    '+': 'post',
    '=': 'put',
    '-': 'delete',
    '?': 'search'
  }
};

var types_map = {
  '<': true,
  '>': true,
  '=': true,
  '+': true,
  '-': true
};


/**
 * Create packet header.
 *
 * @param type    {string}                  Should be a string: '<', '>' or '='.
 * @param method  {string|number|undefined} Optional method or status.
 * @param version {number|undefined}        Optional version.
 *
 * @returns {string|null}
 */
function createHeader(type, method, version)
{
  version = version || 1;

  if (typeof type !== 'string' || type.length != 1 || !types_map[type]) {
    return null;
  }

  if (type === types.TYPE_REQUEST && typeof method === 'string') {
    method = method.toLowerCase();
    if (method !== 'get') {
      type += shortcuts.write[method] || method;
    }
  }

  if (type === types.TYPE_REPLY && typeof method === 'number' && method !== 200) {
    type += method;
  }

  if (version > 1) {
    type += '/' + version;
  }

  return type;
}


/**
 * Read packet header.
 *
 * @param header {string}
 *
 * @returns {object|null}
 */
function readHeader(header)
{
  if (typeof header !== 'string' || header.length < 1 || ['<', '>', '=', '+', '-'].indexOf(header.substr(0, 1)) == -1) {
    return null;
  }

  var out    = { type: header.substr(0, 1) };
  var params = header.substr(1).split('/');

  if (out.type === types.TYPE_REQUEST) {
    out.method = params[0];

    if (out.method) {
      out.method = shortcuts.read[out.method] || out.method;
    }
    else {
      out.method = 'get';
    }
  }

  if (out.type === types.TYPE_REPLY) {
    out.status = params[0];

    if (out.status === '') {
      out.status = 200;
    }
    else if (isNaN(out.status = parseInt(out.status, 10))) {
      return null;
    }
  }

  if (isNaN(out.version = parseInt(params[1], 10)) || out.version < 1) {
    out.version = 1;
  }

  return out;
}


/**
 * Serialize packet object to array or JSON.
 *
 * @param packet {object}  Packet object.
 * @param [json]   {boolean} true to generate JSON instead of array.
 *
 * @returns {object|string|null}
 */
function serialize(packet, json)
{
  if (!packet || typeof packet !== 'object' || typeof packet.id !== 'string' || packet.id.length < 4) {
    return null;
  }

  var out  = [ createHeader(packet.type, packet.type === types.TYPE_REPLY ? packet.status : packet.method, packet.version) ];

  if (out[0] === null) {
    return null;
  }

  if (typeof packet.resource === 'string') {
    out[1] = packet.resource;
  }
  else {
    return null;
  }

  out[2] = packet.id;

  if (packet.date) {
    if (typeof packet.date === 'number') {
      out[3] = packet.date;
    }
    else if (typeof packet.date === 'string') {
      out[3] = isNaN(+packet.date) ? new Date(packet.date).getTime() : +packet.date;
    }
    else if (packet.date instanceof Date) {
      out[3] = packet.date.getTime();
    }
  }
  else {
    out[3] = 0;
  }

  out[4] = packet.headers || {};
  out[5] = packet.body;

  if (json === true) {
    try {
      return JSON.stringify(out);
    }
    catch (e) {
      return null;
    }
  }
  else {
    return out;
  }
}


/**
 * Deserialize packet from JSON or array.
 *
 * @param packet {string|object} JSON or array.
 *
 * @returns {object|null}
 */
function deserialize(packet)
{
  if (typeof packet === 'string') {
    try {
      packet = JSON.parse(packet);
    }
    catch (e) {
      return null;
    }
  }

  if (Object.prototype.toString.call(packet) !== '[object Array]' || packet.length < 3) {
    return null;
  }

  var out = readHeader(packet[0]);
  if (out === null || out.version > 1) {
    return null;
  }

  if (typeof packet[1] === 'string') {
    out.resource = packet[1];
  }
  else {
    return null;
  }

  if (typeof (out.id = packet[2]) !== 'string' || out.id.length < 4) {
    return null;
  }

  if (isNaN(out.date = parseInt(packet[3] || 0, 10))) {
    out.date = 0;
  }

  if (typeof (out.headers = packet[4] || {}) !== 'object' || Object.prototype.toString.call(out.headers) === '[object Array]') {
    out.headers = {};
  }

  out.body = packet[5];

  return out;
}


exports.types        = types;
exports.serialize    = serialize;
exports.deserialize  = deserialize;

// tests
exports.createHeader = createHeader;
exports.readHeader   = readHeader;
