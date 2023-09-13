const EventEmitter = require('events')
const DHT = require('hyperdht')
const ProtomuxRPC = require('protomux-rpc')
const b4a = require('b4a')

const POOL_LINGER = 10000

module.exports = class HyperswarmRPC {
  constructor (options = {}) {
    const {
      valueEncoding,
      seed,
      keyPair = DHT.keyPair(seed),
      bootstrap,
      debug,
      dht
    } = options

    this._dht = dht || new DHT({ keyPair, bootstrap, debug })
    this._defaultKeyPair = keyPair
    this._defaultValueEncoding = valueEncoding
    this._autoDestroy = !dht

    this._clients = new Set()
    this._servers = new Set()

    this._pool = new Map()
    this._timeouts = new Set()
  }

  get dht () {
    return this._dht
  }

  get defaultKeyPair () {
    return this._defaultKeyPair
  }

  createServer (options = {}) {
    const server = new Server(
      this._dht,
      this._defaultKeyPair,
      this._defaultValueEncoding,
      options
    )

    this._servers.add(server)
    server.on('close', () => this._servers.delete(server))

    return server
  }

  async request (publicKey, method, value, options) {
    const ref = this._getCachedClient(publicKey, options)

    ref.active()

    try {
      return ref.client.request(method, value, options)
    } finally {
      await ref.inactive()
    }
  }

  event (publicKey, method, value, options) {
    const ref = this._getCachedClient(publicKey, options)

    ref.active()

    try {
      ref.client.event(method, value, options)
    } finally {
      ref.inactive()
    }
  }

  connect (publicKey, options = {}) {
    const client = new Client(
      this._dht,
      this._defaultValueEncoding,
      publicKey,
      options
    )

    this._clients.add(client)
    client.on('close', () => this._clients.delete(client))

    return client
  }

  async destroy (options = {}) {
    if (!options.force) {
      const closing = []

      for (const server of this._servers) {
        closing.push(server.close())
      }

      await Promise.allSettled(closing)
    }

    for (const client of this._clients.values()) {
      client.destroy()
    }

    for (const ref of this._pool.values()) {
      ref.destroy()
    }

    if (this._autoDestroy) await this._dht.destroy()
  }

  _getCachedClient (publicKey, options) {
    const id = b4a.toString(publicKey, 'hex')
    let ref = this._pool.get(id)

    if (ref) return ref

    ref = new ClientRef(this.connect(publicKey, options), () => {
      this._pool.delete(id)
      ref.destroy()
    })

    this._pool.set(id, ref)

    return ref
  }
}

class ClientRef {
  constructor (client, oninactive) {
    this.activity = 0
    this.client = client
    this.oninactive = oninactive
    this.timeout = null
    this.client.on('close', oninactive)
  }

  clear () {
    if (this.timeout) clearTimeout(this.timeout)
    this.timeout = null
  }

  destroy () {
    if (this.destroyed) return
    this.clear()
    this.destroyed = true
    this.client.destroy()
  }

  active () {
    if (this.destroyed) return
    this.clear()
    this.activity++
  }

  inactive () {
    if (this.destroyed) return
    this.activity--
    if (this.activity === 0) {
      this.timeout = setTimeout(this.oninactive, POOL_LINGER)
    }
  }
}

class Client extends EventEmitter {
  constructor (dht, defaultValueEncoding, publicKey, options = {}) {
    super()

    this._dht = dht
    this._defaultValueEncoding = defaultValueEncoding
    this._publicKey = publicKey

    this._stream = this._dht.connect(publicKey, options)
    this._stream.setKeepAlive(5000)

    this._rpc = new ProtomuxRPC(this._stream, {
      id: publicKey,
      valueEncoding: this._defaultValueEncoding
    })
    this._rpc
      .on('open', this._onopen.bind(this))
      .on('close', this._onclose.bind(this))
      .on('destroy', this._ondestroy.bind(this))

    // For Hypercore replication
    this._stream.userData = this._rpc.mux
  }

  _onopen () {
    this.emit('open')
  }

  _onclose () {
    this._stream.destroy()
    this.emit('close')
  }

  _ondestroy () {
    this.emit('destroy')
  }

  get dht () {
    return this._dht
  }

  get rpc () {
    return this._rpc
  }

  get closed () {
    return this._rpc.closed
  }

  get mux () {
    return this._rpc.mux
  }

  get stream () {
    return this._rpc.stream
  }

  async request (method, value, options = {}) {
    return this._rpc.request(method, value, options)
  }

  event (method, value, options = {}) {
    this._rpc.event(method, value, options)
  }

  async end () {
    await this._rpc.end()
  }

  destroy (err) {
    this._rpc.destroy(err)
  }
}

class Server extends EventEmitter {
  constructor (dht, defaultKeyPair, defaultValueEncoding, options = {}) {
    super()

    this._dht = dht
    this._defaultKeyPair = defaultKeyPair
    this._defaultValueEncoding = defaultValueEncoding

    this._connections = new Set()
    this._responders = new Map()

    this._server = this._dht.createServer(options)
    this._server
      .on('close', this._onclose.bind(this))
      .on('listening', this._onlistening.bind(this))
      .on('connection', this._onconnection.bind(this))
  }

  _onclose () {
    this._connections.clear()
    this._responders.clear()

    this.emit('close')
  }

  _onlistening () {
    this.emit('listening')
  }

  _onconnection (stream) {
    const rpc = new ProtomuxRPC(stream, {
      id: this.publicKey,
      valueEncoding: this._defaultValueEncoding
    })

    // For Hypercore replication
    stream.userData = rpc.mux
    stream.setKeepAlive(5000)

    this._connections.add(rpc)
    rpc.on('close', () => {
      stream.destroy()
      this._connections.delete(rpc)
    })

    for (const [method, { options, handler }] of this._responders) {
      rpc.respond(method, options, wrap(handler, rpc))
    }

    this.emit('connection', rpc)
  }

  get dht () {
    return this._dht
  }

  get closed () {
    return this._server.closed
  }

  get publicKey () {
    return this._server.publicKey
  }

  get connections () {
    return this._connections
  }

  address () {
    return this._server.address()
  }

  async listen (keyPair = this._defaultKeyPair) {
    await this._server.listen(keyPair)
  }

  async close () {
    await this._server.close()
  }

  respond (method, options, handler) {
    if (handler === undefined) {
      handler = options
      options = {}
    }

    this._responders.set(method, { options, handler })

    for (const rpc of this._connections) {
      rpc.respond(method, options, wrap(handler, rpc))
    }

    return this
  }

  unrespond (method) {
    this._responders.delete(method)

    for (const rpc of this._connections) {
      rpc.unrespond(method)
    }

    return this
  }
}

function wrap (handler, rpc) {
  return (request) => handler(request, rpc)
}
