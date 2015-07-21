/* __postgres wrapper */

var config = require('./__config.js');
var logger = require('./__logging.js');
var pg = require('pg');

const conString = 'postgres://'+config.DB_USERNAME+':'+config.DB_PASSWORD+'@'+config.DB_HOST+'/'+config.DB_NAME;

query = function(statement, callback) {
	try {
		pg.connect(conString, function(err, client, done) {
			var _handleError = function(err) {
				if(!err) return false;

				done(client);
				logger.error('Error from query ('+statement+'): ' + err);
				return true;
			};
			
			if(_handleError(err)) return callback(err);
			
			client.query(statement, function(err, result) {
				if(_handleError(err)) return callback(err);
				
				done();
				callback(null, result);
			});
		});
	} catch(err) {
		return callback(err);
	}
}

insert_or_update = function(table, id, array_fields, array_values, is_insert, callback) {
	try {
		var statement, i = 0;
		if(is_insert) {
			var insert_array_fields = "_id,"+array_fields[i], insert_array_values = id + ",'" + array_values[i] +"'";			
			i++;
			while(i < array_fields.length) {
				insert_array_fields += "," + array_fields[i];
				insert_array_values += ",'" + array_values[i] +"'";
				i++;
			}
			statement = "INSERT INTO \"" + table + "\"("+insert_array_fields+") VALUES("+insert_array_values+")";
		} else {
			var update_array = "";
			update_array += array_fields[i] + " = '" + array_values[i] +"'";
			i++;
			while(i < array_fields.length) {
				update_array += " AND " + array_fields[i] + " = " + array_values[i];
				i++;
			}
			statement = "UPDATE \"" + table + "\" SET " + update_array + " WHERE _id = " + id;
		}
		pg.connect(conString, function(err, client, done) {
			var _handleError = function(err) {
				if(!err) return false;

				done(client);
				logger.error('Error from query ('+statement+'): ' + err);
				return true;
			};
			
			if(_handleError(err)) return callback(err);
			
			client.query(statement, function(err, result) {
				if(_handleError(err)) return callback(err);
				
				done();
				callback(null, result);
				client.end();
			});
		});
	} catch(err) {
		return callback(err);
	}
}


module.exports = {
	query : query,
	insert_or_update : insert_or_update
}