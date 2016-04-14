'use strict';

const CLIENT_STATE_DISCONNECTED = -1;
const CLIENT_STATE_CONNECTING   = 0;
const CLIENT_STATE_CONNECTED    = 1;
const CLIENT_OPEN               = 'open';
const CLIENT_CLOSE              = 'close';
const CLIENT_ERROR              = 'error';
const CLIENT_STATE              = 'state';
const CLIENT_PACKET             = 'packet';


module.exports = {
  CLIENT_STATE_DISCONNECTED: CLIENT_STATE_DISCONNECTED,
  CLIENT_STATE_CONNECTING:   CLIENT_STATE_CONNECTING,
  CLIENT_STATE_CONNECTED:    CLIENT_STATE_CONNECTED,
  CLIENT_OPEN:               CLIENT_OPEN,
  CLIENT_CLOSE:              CLIENT_CLOSE,
  CLIENT_ERROR:              CLIENT_ERROR,
  CLIENT_STATE:              CLIENT_STATE,
  CLIENT_PACKET:             CLIENT_PACKET
};
