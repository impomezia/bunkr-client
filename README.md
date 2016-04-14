# bunkr-client

A light-weight SockJS client for Bunkr https://bunkr.chat


# Install

`npm install bunkr-client --save`


# Usage

```javascript
var Client = require('bunkr-client');

const client = new Client('https://bunkr.chat', 'iEQMABvhNfnC4XnMHXDsZ92TFLvikuhNA559m3gMFmEC4W');
client.connect()
  .then(client => client.get('account'))
  .then(packet => {
    console.log(packet.body);
  });
```


# License

MIT