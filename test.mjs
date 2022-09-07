import test from 'brittle'
import DHT from '@hyperswarm/dht'
import createTestnet from '@hyperswarm/testnet'
import { string } from 'compact-encoding'
import crypto from 'hypercore-crypto'

import RPC from './index.js'

test('basic', async (t) => {
  const [dht] = await createTestnet(3, t.teardown)

  const rpc = new RPC({ dht })

  const server = rpc.createServer()
  await server.listen()

  server.respond('echo', (req) => req)

  const client = rpc.connect(server.publicKey)

  t.alike(
    await client.request('echo', Buffer.from('hello world')),
    Buffer.from('hello world')
  )

  await rpc.destroy()
})

test('default encoding', async (t) => {
  const [dht] = await createTestnet(3, t.teardown)

  const rpc = new RPC({ dht, valueEncoding: string })

  const server = rpc.createServer()
  await server.listen()

  server.respond('echo', (req) => {
    t.is(req, 'hello world')
    return req
  })

  const client = rpc.connect(server.publicKey)

  t.alike(
    await client.request('echo', 'hello world'),
    'hello world'
  )

  await rpc.destroy()
})

test('remote key', async (t) => {
  const [dht] = await createTestnet(3, t.teardown)

  const keyPair = crypto.keyPair()

  const rpc = new RPC({ dht, valueEncoding: string })

  const server = rpc.createServer()
  await server.listen()

  server.respond('echo', (req, remoteKey) => {
    t.alike(remoteKey, keyPair.publicKey)
    return req
  })

  const client = rpc.connect(server.publicKey, { keyPair })
  await client.request('echo', 'hello world')

  await rpc.destroy()
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

  await rpc.destroy()
})

test('listen using default key pair', async (t) => {
  const [dht] = await createTestnet(3, t.teardown)

  const rpc = new RPC({ dht })

  const server = rpc.createServer()
  await server.listen()

  t.is(server.publicKey, rpc.defaultKeyPair.publicKey)

  await rpc.destroy()
})

test('listen using custom default key pair', async (t) => {
  const [dht] = await createTestnet(3, t.teardown)
  const keyPair = DHT.keyPair()

  const rpc = new RPC({ dht, keyPair })

  t.is(rpc.defaultKeyPair, keyPair)

  const server = rpc.createServer()
  await server.listen()

  t.is(server.publicKey, keyPair.publicKey)

  await rpc.destroy()
})

test('add responder after connection', async (t) => {
  const [dht] = await createTestnet(3, t.teardown)

  const rpc = new RPC({ dht })

  const server = rpc.createServer()
  await server.listen()

  const client = rpc.connect(server.publicKey)

  await t.exception(client.request('echo', Buffer.alloc(0)), /unknown method 'echo'/)

  server.respond('echo', (req) => req)

  await t.execution(client.request('echo', Buffer.alloc(0)))

  await rpc.destroy()
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

  const client = rpc.connect(server.publicKey)

  const request = client.request('echo', Buffer.alloc(0))

  await server.close()

  await t.exception(request, /channel closed/)

  await rpc.destroy()
})

test('reject inflight request on destroy', async (t) => {
  const [dht] = await createTestnet(3, t.teardown)

  const rpc = new RPC({ dht })

  const server = rpc.createServer()
  await server.listen()

  server.respond('echo', (req) => req)

  const client = rpc.connect(server.publicKey)

  const request = client.request('echo', Buffer.alloc(0))

  await rpc.destroy()

  await t.exception(request, /channel destroyed/)
})

test('reject inflight request on force destroy', async (t) => {
  const [dht] = await createTestnet(3, t.teardown)

  const rpc = new RPC({ dht })

  const server = rpc.createServer()
  await server.listen()

  server.respond('echo', (req) => req)

  const client = rpc.connect(server.publicKey)

  const request = client.request('echo', Buffer.alloc(0))

  await rpc.destroy({ force: true })

  await t.exception(request, /channel destroyed/)
})

test('mux additional channel over connection', async (t) => {
  const [dht] = await createTestnet(3, t.teardown)

  const rpc = new RPC({ dht })

  const server = rpc.createServer()
  await server.listen()

  const io = t.test('io')
  io.plan(2)

  server.on('connection', (rpc) => {
    const msg = setup(rpc.mux)

    msg.onmessage = (req) => {
      io.is(req, 'hello server')
      msg.send('hello client')
    }
  })

  const client = rpc.connect(server.publicKey)

  const msg = setup(client.mux)

  msg.send('hello server')
  msg.onmessage = (req) => {
    io.is(req, 'hello client')
  }

  await io
  await rpc.destroy()

  function setup (mux) {
    const channel = mux.createChannel({
      protocol: 'test'
    })

    const message = channel.addMessage({
      encoding: string
    })

    channel.open()

    return message
  }
})
