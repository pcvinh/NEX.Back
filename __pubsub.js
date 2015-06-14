/* __postgres wrapper */

var config = require('./__config.js');

const pn_publish_key = "pub-c-7b8f064f-cc65-4656-8d63-d6760bb6e0fe";
const pn_subcribe_key = "sub-c-abe025b6-b042-11e4-85c1-02ee2ddab7fe";

var pubnub = require("pubnub")({
    ssl           : true,  // <- enable TLS Tunneling over TCP 
    publish_key   : config.PN_PUBLISH_KEY,
    subscribe_key : config.PN_SUBSCRIBE_KEY
});

publish = function(channel, message, callback) {
	try {
		pubnub.publish({ 
			channel   : channel,
			message   : message,
			callback  : function(e) { 
				if(typeof callback === 'function') callback(null, 'PUBLISH SUCCESS');
			},
			error     : function(e) {
				if(typeof callback === 'function') callback(e);
			}
		});		
	} catch(err) {
		return callback(err);
	}
}

subscribe = function(channels, callback) {
	try {
		pubnub.subscribe({ 
			channel   : channels,
			message   : function(m) {
				callback(null, m);
			},
			error     : function(e) { 
				callback(e);
			}
		});		
	} catch(err) {
		return callback(err);
	}
}

unsubscribe = function(channels) {
	pubnub.unsubscribe({channel : channels});
}


module.exports = {
	publish : publish,
	subscribe : subscribe,
	unsubscribe :unsubscribe
}