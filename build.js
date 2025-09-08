const path = require('path')
const Hyperschema = require('hyperschema')

const SPEC = path.join(__dirname, 'spec/hyperschema')

const schema = Hyperschema.from(SPEC, { versioned: false })
const rpc = schema.namespace('rpc')

rpc.register({
  name: 'handshake',
  fields: [
    {
      name: 'capability',
      type: 'fixed32'
    }
  ]
})

Hyperschema.toDisk(schema, SPEC)
