var config = require('./__config.js');
var winston = require('winston');

if(config.is_prod) {
	winston.add(winston.transports.DailyRotateFile, {datePattern: '.yyyy-MM-dd', filename: config.log_path + 'log.log', timestamp: true});
	winston.remove(winston.transports.Console);
	winston.add(winston.transports.Console, {timestamp: true, colorize: true});
	//winston.remove(winston.transports.Console);
} else {
	winston.add(winston.transports.DailyRotateFile, {datePattern: '.yyyy-MM-dd', filename: config.log_path + 'log.log', timestamp: true});
	winston.remove(winston.transports.Console);
	winston.add(winston.transports.Console, {timestamp: true, colorize: true});
}

log = function(msg) {
	winston.log('info', msg);
}

info = function(msg, module) {
	if(config.debug[module] !== null && config.debug[module]) 
		winston.info(msg);
}

error = function(msg) {
	winston.error(msg);
}

module.exports = {
	log : log,
	info : info,
	error : error
}