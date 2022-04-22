const EventEmitter = require('events')
const DHT = require('@hyperswarm/dht')
const HashMap = require('turbo-hash-map')
const ProtomuxRPC = require('protomux-rpc')

module.exports = class HyperswarmRPC {
  constructor (options = {}) {
    const {
      timeout = 5000,
      seed,
      keyPair = DHT.keyPair(seed),
      bootstrap,
      debug,
      dht = new DHT({ keyPair, bootstrap, debug })
    } = options

    this._dht = dht
    this._defaultKeyPair = keyPair
    this._timeout = timeout

    this._connections = new HashMap()
    this._servers = new Set()
  }

  createServer (options = {}) {
    const server = new Server(this._dht, this._defaultKeyPair, this._timeout, options)

    this._servers.add(server)
    server.on('close', () => this._servers.delete(server))

    return server
  }

  async request (publicKey, method, value, options = {}) {
    let rpc = this._connections.get(publicKey)

    if (rpc === undefined) {
      const stream = this._dht.connect(publicKey, {
        keyPair: this._defaultKeyPair
      })

      stream.setTimeout(this._timeout)

      rpc = new ProtomuxRPC(stream, { id: publicKey })

      this._connections.set(publicKey, rpc)
      rpc.on('close', () => {
        stream.destroy()
        this._connections.delete(publicKey)
      })
    }

    return rpc.request(method, value, options)
  }

  async destroy (options = {}) {
    if (!options.force) {
      const closing = []

      for (const server of this._servers) {
        closing.push(server.close())
      }

      await Promise.allSettled(closing)
    }

    for (const rpc of this._connections.values()) {
      rpc.close()
    }
  }
}

class Server extends EventEmitter {
  constructor (dht, defaultKeyPair, timeout, options = {}) {
    super()

    const {
      firewall,
      holepunch
    } = options

    this._dht = dht
    this._defaultKeyPair = defaultKeyPair
    this._timeout = timeout

    this._connections = new HashMap()
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
    stream.setTimeout(this._timeout)

    const rpc = new ProtomuxRPC(stream, { id: this.publicKey })

    this._connections.set(stream.publicKey, rpc)
    rpc.on('close', () => {
      stream.destroy()
      this._connections.delete(stream.publicKey)
    })

    for (const [method, { options, handler }] of this._responders) {
      rpc.respond(method, options, handler)
    }
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

    for (const rpc of this._connections.values()) {
      rpc.respond(method, options, handler)
    }

    return this
  }
}
