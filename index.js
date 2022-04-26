const EventEmitter = require('events')
const DHT = require('@hyperswarm/dht')
const ProtomuxRPC = require('protomux-rpc')

module.exports = class HyperswarmRPC {
  constructor (options = {}) {
    const {
      valueEncoding,
      seed,
      keyPair = DHT.keyPair(seed),
      bootstrap,
      debug,
      dht = new DHT({ keyPair, bootstrap, debug })
    } = options

    this._dht = dht
    this._defaultKeyPair = keyPair
    this._defaultValueEncoding = valueEncoding

    this._clients = new Set()
    this._servers = new Set()
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
  }
}

class Client extends EventEmitter {
  constructor (dht, defaultValueEncoding, publicKey, options = {}) {
    super()

    const {
      nodes,
      keyPair
    } = options

    this._dht = dht
    this._defaultValueEncoding = defaultValueEncoding
    this._publicKey = publicKey

    this._stream = this._dht.connect(publicKey, { nodes, keyPair })

    this._client = new ProtomuxRPC(this._stream, {
      id: publicKey,
      valueEncoding: this._defaultValueEncoding
    })
    this._client
      .on('open', this._onopen.bind(this))
      .on('close', this._onclose.bind(this))
      .on('destroy', this._ondestroy.bind(this))
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

  async request (method, value, options = {}) {
    return this._client.request(method, value, options)
  }

  event (method, value, options = {}) {
    this._client.event(method, value, options)
  }

  async end () {
    await this._client.end()
  }

  destroy (err) {
    this._client.destroy(err)
  }
}

class Server extends EventEmitter {
  constructor (dht, defaultKeyPair, defaultValueEncoding, options = {}) {
    super()

    const {
      firewall,
      holepunch
    } = options

    this._dht = dht
    this._defaultKeyPair = defaultKeyPair
    this._defaultValueEncoding = defaultValueEncoding

    this._connections = new Set()
    this._responders = new Map()

    this._server = this._dht.createServer({ firewall, holepunch })
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

    this._connections.add(rpc)
    rpc.on('close', () => {
      stream.destroy()
      this._connections.delete(rpc)
    })

    for (const [method, { options, handler }] of this._responders) {
      rpc.respond(method, options, handler)
    }
  }

  get closed () {
    return this._server.closed
  }

  get publicKey () {
    return this._server.publicKey
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
      rpc.respond(method, options, handler)
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
