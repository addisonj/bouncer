var bouncy = require('bouncy')
var mdns = require('mdns')
var crypto = require('crypto')
var os = require('os')

var DEFAULT_KEY = require("./default_key")

var noop = function() {}

function parseServices(services) {
  services = services || {}
  var parsed = {}
  for (var name in services) {
    var host = services[name]
    parsed[name] = {fallback: host, hosts: []}
  }
  return parsed
}

function getLocalIps() {
  var localIPs = []
  var interfaces = os.networkInterfaces()
  for (var k in interfaces) {
    for (var k2 in interfaces[k]) {
      var address = interfaces[k][k2]
      if (address.family === 'IPv4' && !address.internal) {
        localIPs.push(address.address)
      }
    }
  }
  return localIPs
}

function Bouncer(conf) {
  conf = conf || {}
  var self = this
  this.services = parseServices(conf.services)
  this.connectedByName = {}

  this.localOnly = conf.localOnly || false

  if (this.localOnly) {
    this.ips = getLocalIps()
  }

  this.port = conf.port || 8000
  this.key = conf.key || DEFAULT_KEY

  this.secret = conf.secret
  this.globalFallback = conf.globalFallback

  this.onServiceUp = conf.onServiceUp || noop
  this.onServiceDown = conf.onServiceDown || noop

  if (conf.onGlobalFault) this.onGlobalFault = conf.onGlobalFault
  if (conf.onServiceFault) this.onServiceFault = conf.onServiceFault
  if (conf.verifyHost) this.verifyHost = conf.verifyHost


  this.browser = mdns.createBrowser(mdns.tcp('http'))

  this.browser.on('serviceUp', function(service) {
    self.serviceUp(service)
  })

  this.browser.on('serviceDown', function(service) {
    self.serviceDown(service)
  })


}


Bouncer.prototype.onGlobalFault = function(req, bounce, serviceName) {
  if (this.globalFallback) {
    bounce(this.globalFallback)
  } else {
    var res = bounce.respond()
    res.writeHead(503, {'Content-Type': 'text/plain'})
    res.end('Service Not Availiable\n')
  }
}

Bouncer.prototype.onServiceFault = function(req, bounce, serviceObj) {
  if (serviceObj.fallback) {
    bounce(serviceObj.fallback)
  } else {
    this.onGlobalFault(req, bounce, serviceObj.name)
  }
}

Bouncer.prototype.start = function(cb) {
  cb = cb || noop
  var self = this
  this.browser.start()

  bouncy(function(req, bounce) {
    var serviceName = req.headers.host.split(".")[0]
    var serviceObj = self.services[serviceName]
    
    if (!serviceObj) {
      return self.onGlobalFault(req, bounce, serviceName)
    }

    var hosts = serviceObj.hosts

    if (!hosts.length) {
      return self.onServiceFault(req, bounce, serviceObj)
    }

    // we need to round robin this somehow...
    var server = hosts[0]
    bounce(server.host, server.port)

  }).listen(this.port, cb)
}

Bouncer.prototype.verifyHost = function(service) {
  // no secret? then return true
  if (!this.secret) return true
  // if we have a secret, but no token, then we must fail validation
  if (!service.txtRecord.token) return false
  var token = service.txtRecord.token
  return token === crypto.createHmac("sha1", this.key).update(this.secret).digest("hex")
}

Bouncer.prototype.checkLocalIp = function(addresses) {
  var self = this
  var haveIp = false
  addresses.forEach(function(address) {
    if (self.ips.indexOf(address) > -1) {
      haveIp = true
    }
  })

  return haveIp
}

Bouncer.prototype.serviceUp = function(service) {
  if (!service.txtRecord || !service.txtRecord.service) return

  if (!this.verifyHost(service)) return

  if (this.localOnly && !this.checkLocalIp(service.addresses)) {
    return
  }

  var serviceName = service.txtRecord.service

  // we can get multiple hosts by the same name on different addresses
  this.connectedByName[service.name] = service

  if (this.services[serviceName]) {
    this.services[serviceName].hosts.push(service)
  } else {
    this.services[serviceName] = { hosts: [service] }
  }

  this.onServiceUp(service)
}

Bouncer.prototype.serviceDown = function(toRemove) {
  // retrieve the original record to ease finding
  var service = this.connectedByName[toRemove.name]
  
  if (!service) return
  if (!service.txtRecord || !service.txtRecord.service) return

  var serviceName = service.txtRecord.service

  var serverObj = this.services[serviceName]

  if (!serverObj) {
    console.log("found a service that we never added", service)
    return
  }

  if (serverObj.hosts.length > 0) {

    serverObj.hosts = this.removeByHostName(serverObj.hosts, service.name)

    this.services[serviceName] = serverObj
    delete this.connectedByName[serviceName]
  } 

  this.onServiceDown(service)
  
}

Bouncer.prototype.removeByHostName = function(hosts, hostName) {
  hosts = hosts.filter(function(host) {
    return hostName !== host.name
  })
  
  return hosts
}

module.exports = Bouncer
