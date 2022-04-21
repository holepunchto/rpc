import test from 'brittle'
import createTestnet from '@hyperswarm/testnet'

import RPC from './index.js'

test('basic', async (t) => {
  const [dht] = await createTestnet(3, t.teardown)

  const rpc = new RPC(dht)

  const server = rpc.createServer()
  await server.listen()

  server.respond('echo', (req) => req)

  t.alike(
    await rpc.request(server.publicKey, 'echo', Buffer.from('hello world')),
    Buffer.from('hello world')
  )
})
