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

await rpc.request(server.publicKey, 'echo', Buffer.from('hello world'))
// <Buffer 'hello world'>
```

## API

#### `const rpc = new RPC([options])`

Construct a new RPC instance.

Options include:

```js
{
  // The duration for which connections should be kept alive without activity.
  timeout: 5000,
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

#### `const response = await rpc.request(method, value[, options])`

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

#### `await rpc.destroy([options])`

Fully destroy this RPC instance.

This will also close any running servers. If you want to force close the instance without waiting for the servers to close pass `{ force: true }`.

### Creating servers

#### `const server = rpc.createServer([options])`

Create a new RPC server for responding to requests.

Options are the same as [`dht.createServer()`](https://github.com/hyperswarm/dht#const-server--nodecreateserveroptions-onconnection).

#### `await server.listen([keyPair])`

Make the server listen on a key pair, defaulting to `rpc.defaultKeyPair`. To connect to this server use `keyPair.publicKey` as the connect address.

#### `server.respond(method[, options], handler)`

Register a handler for an RPC method. The handler is passed the request value and must either return the response value or throw an error.

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

#### `server.on('close')`

Emitted when the server is fully closed.

## License

ISC
