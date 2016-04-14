'use strict';

const alphabet = "123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
const base     = alphabet.length;
const crc8     = require('crc/lib/crc8');


/**
 * Internal base58 encode.
 *
 * @param num
 * @returns {string}
 */
function encode(num) {
  var mod;
  var str = '';

  if (typeof num !== 'number') {
    num = parseInt(num);
  }

  while (num >= base) {
    mod = num % base;
    str = alphabet[mod] + str;
    num = (num - mod) / base;
  }

  return alphabet[num] + str;
}


/**
 * Internal base58 decode.
 *
 * @param str
 * @returns {number}
 */
function decode(str) {
  var index;
  var num = 0;
  var ref = str.split('').reverse();

  for (var i = 0; i < ref.length; ++i) {
    if ((index = alphabet.indexOf(ref[i])) === -1) {
      throw new Error('Value passed is not a valid Base58 string.');
    }

    num += index * Math.pow(base, i);
  }

  return num;
}


/**
 * Generate random id with specified size.
 *
 * @param size
 * @returns {string}
 */
function generate(size) {
  size = size || 7;
  if (typeof size !== 'number' || size < 3)
    size = 3;

  var text = '';

  for (var i = 0; i < size - 2; i++ ) {
    text += alphabet.charAt(Math.floor(Math.random() * base));
  }

  return text + encode(crc8(text) + base);
}


/**
 * Check id valid or not.
 *
 * @param id
 * @returns {boolean}
 */
function isValid(id) {
  if (typeof id !== 'string' || id.length < 3) {
    return false;
  }

  var checksum;
  try {
    checksum = decode(id.substr(id.length - 2)) - base;
  }
  catch (e) {
    return false;
  }

  var body = id.substr(0, id.length - 2);
  return crc8(body) === checksum;
}

exports.generate = generate;
exports.isValid  = isValid;