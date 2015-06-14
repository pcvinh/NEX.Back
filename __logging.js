var config = require('./__config.js');
var winston = require('winston');

if(config.is_prod) {
	winston.add(winston.transports.DailyRotateFile, {datePattern: '.yyyy-MM-ddTHH', filename: 'log.log'});
	winston.remove(winston.transports.Console);
}


info = function(msg, module) {
	if(config.debug[module]) 
		winston.info(msg);
}

error = function() {

}

module.exports = {

}