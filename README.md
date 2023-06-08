# Hyperswarm RPC

Simple RPC over the Hyperswarm DHT, backed by [Protomux](https://github.com/mafintosh/protomux).

```sh
npm install @hyperswarm/rpc
```

## Usage

```js
const RPC = require('@hyperswarm/rpc')

const rpc = new RPC()

const server = rpc.createServer()
await server.listen()

server.respond('echo', (req) => req)

const client = rpc.connect(server.publicKey)
await client.request('echo', Buffer.from('hello world'))
// <Buffer 'hello world'>
```

## API

#### `const rpc = new RPC([options])`

Construct a new RPC instance.

Options include:

```js
{
  // Optional default value encoding.
  valueEncoding: encoding,
  // A Noise keypair that will be used by default to listen/connect on the DHT.
  // Defaults to a new key pair.
  keyPair,
  // A unique, 32-byte, random seed that can be used to deterministically 
  // generate the key pair.
  seed: buffer,
  // Optionally overwrite the default bootstrap servers. Not used if a DHT
  // instance is passed instead.
  bootstrap: ['host:port'],
  // A DHT instance. Defaults to a new instance.
  dht
}
```

#### `await rpc.destroy([options])`

Fully destroy this RPC instance.

This will also close any running servers. If you want to force close the instance without waiting for the servers to close pass `{ force: true }`.

If a DHT instance was passed when constructing the RPC instance, this DHT will *not* be destroyed; the RPC instance will only destroy DHT instances that it itself has constructed.

### Creating clients

#### `const client = rpc.connect(publicKey[, options])`

Options are the same as [`dht.connect()`](https://github.com/holepunchto/hyperdht#const-encryptedconnection--nodeconnectremotepublickey-options).

#### `client.dht`

The [`DHT`](https://github.com/holepunchto/hyperdht#api) instance used by the client.

#### `client.rpc`

The [`ProtomuxRPC`](https://github.com/holepunchto/protomux-rpc#api) instance used by the client.

#### `client.closed`

Whether or not the RPC channel is closed.

#### `client.mux`

The muxer used by the channel.

#### `client.stream`

The stream used by the channel.

#### `const response = await client.request(method, value[, options])`

Perform an RPC request, returning a promise that will resolve with the value returned by the request handler or reject with an error.

Options include:

```js
{
  // Optional encoding for both requests and responses, defaults to raw
  valueEncoding: encoding,
  requestEncoding: encoding, // Optional encoding for requests
  responseEncoding: encoding // Optional encoding for responses
}
```

#### `client.event(method, value[, options])`

Perform an RPC request but don't wait for a response.

Options are the same as `client.request()`.

#### `client.cork()`

Cork the underlying channel. See [`channel.cork()`](https://github.com/mafintosh/protomux#channelcork) for more information.

#### `client.uncork()`

Uncork the underlying channel. See [`channel.uncork()`](https://github.com/mafintosh/protomux#channeluncork) for more information.

#### `await client.end()`

Gracefully end the RPC channel, waiting for all inflights requests before closing.

#### `client.destroy([err])`

Forcefully close the RPC channel, rejecting any inflight requests.

#### `client.on('open', [handshake])`

Emitted when the remote side adds the RPC protocol.

#### `client.on('close')`

Emitted when the RPC channel closes, i.e. when the remote side closes or rejects the RPC protocol or we closed it.

#### `client.on('destroy')`

Emitted when the RPC channel is destroyed, i.e. after `close` when all pending promises has resolved.

### Requesting without clients

#### `const response = await rpc.request(publicKey, method, value[, options])`

Same as `client.request` but allocates a client in the internal pool that is auto closed after 10s of inactivity or rpc destruction.

#### `rpc.event(publicKey, method, value[, options])`

Same as `client.event` but allocates a client in the internal pool that is auto closed after 10s of inactivity or rpc destruction.

### Creating servers

#### `const server = rpc.createServer([options])`

Create a new RPC server for responding to requests.

Options are the same as [`dht.createServer()`](https://github.com/holepunchto/hyperdht#const-server--nodecreateserveroptions-onconnection).

#### `server.dht`

The [`DHT`](https://github.com/holepunchto/hyperdht#api) instance used by the server.

#### `await server.listen([keyPair])`

Make the server listen on a key pair, defaulting to `rpc.defaultKeyPair`. To connect to this server use `keyPair.publicKey` as the connect address.

#### `server.respond(method[, options], handler)`

Register a handler for an RPC method. The handler has the signature `handler(request, rpc)` and must either return the response value or throw an error. `rpc` is a [`ProtomuxRPC`](https://github.com/holepunchto/protomux-rpc#api) instance.

Note that `rpc.stream` is a [`HyperswarmSecretStream`](https://github.com/holepunchto/hyperswarm-secret-stream) instance, from which you can get information about the connection. For example, `rpc.stream.remotePublicKey` returns the public key of the initiator of the request.

Only a single handler may be active for any given method; any previous handler is overwritten when registering a new one.

Options include:

```js
{
  // Optional encoding for both requests and responses, defaults to raw
  valueEncoding: encoding,
  requestEncoding: encoding, // Optional encoding for requests
  responseEncoding: encoding // Optional encoding for responses
}
```

#### `server.unrespond(method)`

Remove a handler for an RPC method.

#### `await server.close()`

Stop listening.

#### `server.address()`

Returns an object containing the address of the server:

```js
{
  host, // External IP of the server,
  port, // External port of the server if predictable,
  publicKey // Public key of the server
}
```

#### `server.on('listening')`

Emitted when the server is fully listening on a key pair.

#### `server.on('connection', rpc)`

Emitted when an RPC client connects. `rpc` is a [`ProtomuxRPC`](https://github.com/holepunchto/protomux-rpc#api) instance.

#### `server.on('close')`

Emitted when the server is fully closed.

## License

Apache-2.0
