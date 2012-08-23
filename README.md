[![build status](https://secure.travis-ci.org/addisonj/bouncer.png)](http://travis-ci.org/addisonj/bouncer)
#Bouncer
Bouncer is a simple router that uses MDNS and substack's bouncy to magically discover your apps and services to hit and fallback when neccessary. 

##Install
###Prereqs
For bouncy to be useful, you need to redirect a wildcard subdomain to localhost (*.dev.local for example). There are lots of methods to do this, but here is one way for OSX.

(shamelessly borrowed from http://onemoredigit.com/post/2155404559/wildcard-etc-hosts-an-alternative)

1. install dnsmasq

  ``` 
  brew install dnsmasq
  ```

2. copy the example config

  ``` 
  cp /usr/local/Cellar/dnsmasq/2.55/dnsmasq.conf.example /usr/local/etc/dnsmasq.conf
  ```

3. edit `dnsmasq.conf` to include the following

  ```
  address=/com.local/127.0.0.1
  listen-address=127.0.0.1
  ```
  where "com.local" is the domain you want to redirect on. I use `dev.local`.

4. (optional) Add the dnsmasq launchd config (provided by homebrew) to your system. Homebrew tells you how to do this.

5. Add your localhost to you list of DNS servers
  System Preferences > Network > Advanced (on your preffered adapter) > DNS
  Now add your list of servers (I use google DNS to be faster!)
  ```
  127.0.0.1
  8.8.8.8
  8.8.4.4
  ```

###Installation
1. install it
```
npm install -g bouncer
```
2. Advertise your services (see below)
3. run bouncer
```
bouncer -c /path/to/conf.json
```

NOTE: defaults to ~/.bouncer.json if no config is passed

See below for config info

##Advertising services
Bouncer relies on MDNS (aka. Bounjour, ZeroConf) to discover your services, in order for this to work however, you must create and advertisement for that service

app.js
```
var advertise = require('bouncer').advertise
...
var options = {secret: "cheesecake"}
app.listen(PORT, advertise("service_name", PORT, options))
```

See below for list of options

##Config
Bouncer uses a json config file to define a secret, a list of services with fallbacks, and other options

sample_config.json (obvs without the comments!)
```
  // port to listen on
  "port" : 8000,
  // secret to use (match with your advertisement)
  "secret" : "mysecret",
  // OPTIONAL - key used to encrypt
  "key": "123456789123",
  // OPTIONAL - a fallback if no corresponding service is found
  "globalFallback" : "http://mydomain.com",
  // only bind with local instances of the service, default to false
  "localOnly": false,
  // a hash of service names and the fallback url to use
  "services" : {
    "service1" : "service1.mydomain.com",
    "service2" : "service2.mydomain.com",
  }
```

###Advertise
the advertise options hash taskes a secret and a key, match to above

##API
If you want to use Bouncer programatically, you can.

```
var Bouncer = require('bouncer').Bouncer
var bouncer = new Bouncer(opts)
bouncer.start()
```

opts takes all the same options as the json config and also a few functions

onServiceUp(mdnsRecord) - fired when a service is registered

onServiceDown(mdnsRecord) - fired when a service is removed

onGlobalFault(request, bouncyInstance, serviceName) - handle global faults

onServiceFault(request, bouncyInstance, serverObj) - handle faults for an individual services, serverObj is {name: "service_name", hosts; [mdnsRecord]}

verifyHost(mdnsRecrd) - return true if you want to accept the service



