import test from 'brittle'
import DHT from '@hyperswarm/dht'
import createTestnet from '@hyperswarm/testnet'

import RPC from './index.js'

test('basic', async (t) => {
  const [dht] = await createTestnet(3, t.teardown)

  const rpc = new RPC({ dht })

  const server = rpc.createServer()
  await server.listen()

  server.respond('echo', (req) => req)

  t.alike(
    await rpc.request(server.publicKey, 'echo', Buffer.from('hello world')),
    Buffer.from('hello world')
  )
})

test('server address', async (t) => {
  const [dht] = await createTestnet(3, t.teardown)

  const rpc = new RPC({ dht })

  const server = rpc.createServer()
  await server.listen()

  t.alike(server.address(), {
    host: dht.host,
    port: dht.port,
    publicKey: server.publicKey
  })
})

test('listen using default key pair', async (t) => {
  const [dht] = await createTestnet(3, t.teardown)

  const rpc = new RPC({ dht })

  const server = rpc.createServer()
  await server.listen()

  t.is(server.publicKey, rpc.defaultKeyPair.publicKey)
})

test('listen using custom default key pair', async (t) => {
  const [dht] = await createTestnet(3, t.teardown)
  const keyPair = DHT.keyPair()

  const rpc = new RPC({ dht, keyPair })

  t.is(rpc.defaultKeyPair, keyPair)

  const server = rpc.createServer()
  await server.listen()

  t.is(server.publicKey, keyPair.publicKey)
})

test('add responder after connection', async (t) => {
  const [dht] = await createTestnet(3, t.teardown)

  const rpc = new RPC({ dht })

  const server = rpc.createServer()
  await server.listen()

  await t.exception(rpc.request(server.publicKey, 'echo', Buffer.alloc(0)), /unknown method 'echo'/)

  server.respond('echo', (req) => req)

  await t.execution(rpc.request(server.publicKey, 'echo', Buffer.alloc(0)))
})

test('destroy', async (t) => {
  const [dht] = await createTestnet(3, t.teardown)

  const rpc = new RPC({ dht })

  const server = rpc.createServer()
  await server.listen()

  await rpc.destroy()

  t.is(server.closed, true)
  t.is(dht.destroyed, false)
})

test('force destroy', async (t) => {
  const [dht] = await createTestnet(3, t.teardown)

  const rpc = new RPC({ dht })

  const server = rpc.createServer()
  await server.listen()

  await rpc.destroy({ force: true })

  t.is(server.closed, false)
})

test('reject inflight request on server close', async (t) => {
  const [dht] = await createTestnet(3, t.teardown)

  const rpc = new RPC({ dht })

  const server = rpc.createServer()
  await server.listen()

  server.respond('echo', (req) => req)

  const request = rpc.request(server.publicKey, 'echo', Buffer.alloc(0))

  await server.close()

  t.exception(request, /channel closed/)
})

test('reject inflight request on destroy', async (t) => {
  const [dht] = await createTestnet(3, t.teardown)

  const rpc = new RPC({ dht })

  const server = rpc.createServer()
  await server.listen()

  server.respond('echo', (req) => req)

  const request = rpc.request(server.publicKey, 'echo', Buffer.alloc(0))

  await rpc.destroy()

  t.exception(request, /channel destroyed/)
})

test('reject inflight request on force destroy', async (t) => {
  const [dht] = await createTestnet(3, t.teardown)

  const rpc = new RPC({ dht })

  const server = rpc.createServer()
  await server.listen()

  server.respond('echo', (req) => req)

  const request = rpc.request(server.publicKey, 'echo', Buffer.alloc(0))

  await rpc.destroy({ force: true })

  t.exception(request, /channel destroyed/)
})
