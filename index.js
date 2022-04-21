const HashMap = require('turbo-hash-map')
const ProtomuxRPC = require('protomux-rpc')

module.exports = class HyperswarmRPC {
  constructor (dht) {
    this._dht = dht

    this._connections = new HashMap()
    this._servers = new Set()
  }

  createServer () {
    const server = new Server(this._dht)
    this._servers.add(server)
    return server
  }

  request (publicKey, method, value, opts = {}) {
    let rpc = this._connections.get(publicKey)

    if (rpc === undefined) {
      const stream = this._dht.connect(publicKey, opts)

      rpc = new ProtomuxRPC(stream, { id: publicKey })
      this._connections.set(publicKey, rpc)
    }

    return rpc.request(method, value, opts)
  }
}

class Server {
  constructor (dht) {
    this._dht = dht

    this._server = this._dht.createServer(this._onconnection.bind(this))

    this._connections = new HashMap()
    this._responders = new Map()
  }

  _onconnection (stream) {
    const rpc = new ProtomuxRPC(stream, { id: this.publicKey })
    this._connections.set(stream.publicKey, rpc)

    for (const [method, { opts, fn }] of this._responders) {
      rpc.respond(method, opts, fn)
    }
  }

  get publicKey () {
    return this._server.publicKey
  }

  async listen (keyPair) {
    await this._server.listen(keyPair)
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
  }
}
