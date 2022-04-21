const EventEmitter = require('events')
const HashMap = require('turbo-hash-map')
const ProtomuxRPC = require('protomux-rpc')

const DEFAULT_TIMEOUT = 5000

module.exports = class HyperswarmRPC {
  constructor (dht) {
    this._dht = dht

    this._connections = new HashMap()
    this._servers = new Set()
  }

  createServer (opts = {}) {
    const server = new Server(this._dht, opts)

    this._servers.add(server)
    server.on('close', () => this._servers.delete(server))

    return server
  }

  async request (publicKey, method, value, opts = {}) {
    let rpc = this._connections.get(publicKey)

    if (rpc === undefined) {
      const stream = this._dht.connect(publicKey, opts)
      stream.setTimeout(opts.timeout || DEFAULT_TIMEOUT)

      rpc = new ProtomuxRPC(stream, { id: publicKey })

      this._connections.set(publicKey, rpc)
      rpc.on('close', () => this._connections.delete(publicKey))
    }

    return rpc.request(method, value, opts)
  }

  async destroy (opts = {}) {
    if (!opts.force) {
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
  constructor (dht, opts) {
    super()

    this._dht = dht
    this._opts = opts

    this._connections = new HashMap()
    this._responders = new Map()

    this._server = this._dht.createServer(typeof opts === 'object' && opts)
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
    stream.setTimeout(this._opts.timeout || DEFAULT_TIMEOUT)

    const rpc = new ProtomuxRPC(stream, { id: this.publicKey })

    this._connections.set(stream.publicKey, rpc)
    rpc.on('close', () => this._connections.delete(stream.publicKey))

    for (const [method, { opts, fn }] of this._responders) {
      rpc.respond(method, opts, fn)
    }
  }

  get publicKey () {
    return this._server.publicKey
  }

  address () {
    return this._server.address()
  }

  async listen (keyPair) {
    await this._server.listen(keyPair)
  }

  async close () {
    await this._server.close()
  }

  respond (method, opts, fn) {
    if (fn === undefined) {
      fn = opts
      opts = {}
    }

    this._responders.set(method, { opts, fn })

    for (const rpc of this._connections.values()) {
      rpc.respond(method, opts, fn)
    }

    return this
  }
}
