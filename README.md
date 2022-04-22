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

## License

ISC
