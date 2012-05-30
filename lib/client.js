var mdns = require('mdns')
var crypto = require('crypto')
var DEFAULT_KEY = require("./default_key")

var encryptSecret = function(secret, key) {
  if (!secret || !key) return false
  return crypto.createHmac("sha1", key).update(secret).digest("hex")
}

var buildTxtRecord = function(service, opts) {
  return {
    txtRecord: {
      service: service
      , info: opts.info
      , token: opts.encryptSecret(opts.secret, opts.key)
    }
  }
}

module.exports = function(service, port, opts, cb) {
  cb = cb || function() {}

  opts.key = opts.key || DEFAULT_KEY
  opts.encryptSecret = opts.encryptSecret || encryptSecret

  var txtRecord = buildTxtRecord(service, opts)

  var ad = mdns.createAdvertisement(mdns.tcp('http'), port, txtRecord)

  cb()
}
