var config = require('./__config.js');
var db = require('./__postgres.js');
var pubsub = require('./__pubsub.js');
var logger = require('./__logging.js');

var request = require('request');
var jsonwebtoken = require('jsonwebtoken');
var hash = require('password-hash'); // Importance Note: will try to use bcrypt later.
var _ = require('lodash');

/////////////////////////////////////////////////////////////////////

/*********************************************

**********************************************/

signin = function(email, password, callback) {
	var statement = 'SELECT "_id", "nickname", "avatar","password" from "User" WHERE email like \''+email+'\'';
	db.query(statement, function(err, result) {
		if(err) return callback(err);
		
		if(result.rows.length > 0) { // SIGN IN. check password. 
				//var hash_password = hash.generate(password);
				
				if(hash.verify(password, result.rows[0].password)) { // sign in success. return token.					
					if(result.rows[0].nickname) { // Sign IN success
						var token = jsonwebtoken.sign({ _id: result.rows[0]._id, nickname : result.rows[0].nickname, avatar : result.rows[0].avatar}, config.JWT_SECRET);
						callback(null, {retcode: 0, token : token, id : result.rows[0]._id,  avatar : result.rows[0].avatar, nickname : result.rows[0].nickname});
					} else { // Force to Sign UP nickname
						callback(null, {retcode: 1, id : result.rows[0]._id});
					}
				} else {	// sign in false.
					callback(null, {retcode: -1});
				}
			} else { // there is no record for this user, SIGN UP then login by return token
				var hash_password = hash.generate(password);
				_signup(email, hash_password, callback);
			}
	});
}

_signup = function(email, hash_password, callback) {
	var statement = 'INSERT INTO "User"(email, password) VALUES(\''+email+'\', \''+hash_password+'\') RETURNING _id';
	db.query(statement, function(err, result) {
		if(err) return callback(err);
		
		//console.log('Success Create new Account but have to Register basic before can use. id = ' + result.rows[0]._id);
		callback(null, {retcode: 1, id : result.rows[0]._id});
	});
}

signup_basic_nickname = function(id, nickname, callback) {
	var table = "User",
	id = id,
	array_fields = ["nickname"],
	array_values = [nickname];
	
	db.insert_or_update(table, id, array_fields, array_values, false, function(err, result) {
		if(err) return callback(err);
		
		var token = jsonwebtoken.sign({ _id: id, nickname : nickname}, config.JWT_SECRET);
		callback(null, {retcode: 0, token : token, id : id, nickname : nickname });
	});
}

signup_basic_avatar = function(token, avatar, callback) {
	var table = "User",
	id = jsonwebtoken.decode(token)._id,
	array_fields = ["avatar"],
	array_values = [avatar],
	nickname = jsonwebtoken.decode(token).nickname;
	
	db.insert_or_update(table, id, array_fields, array_values, false, function(err, result) {
		if(err) return callback(err);
		
		var token = jsonwebtoken.sign({ _id: id, nickname : nickname, avatar : avatar}, config.JWT_SECRET);
		callback(null, {retcode: 0, token : token, nickname : nickname, avatar : avatar});
	});
}

signup_basic_fullname = function(token, fullname, callback) {
	var table = "UserProfile",
	id = jsonwebtoken.decode(token)._id,
	array_fields = ["fullname"],
	array_values = [fullname];
	
	db.insert_or_update(table, id, array_fields, array_values, true, function(err, result) {
		if(err) return callback(err);
		
		callback(null, {retcode: 0});
	});
}


init = function(token, callback) {
	var user_id = jsonwebtoken.decode(token)._id;
	
	var statement = 'SELECT DISTINCT  "_id",fav_name from "RadarFavourite" WHERE _user_id = \''+user_id+'\'';
	db.query(statement, function(err, result) {
		if(err) return callback(err);
		
		var fav_list = [];
		var i = 0;
		while( i < result.rows.length) {
			var temp = {};
			temp.id = result.rows[i]._id;
			temp.n = result.rows[i].fav_name;
			fav_list.push(temp);
			i++;
		}
		
		callback(null, {retcode: 0, fav_list : fav_list});
	});
}

/*********************************************

**********************************************/

init_radar_here = function(token, lat, lng, callback) {
	var google_map_api_url= 'https://maps.googleapis.com/maps/api/place/nearbysearch/json?location='+lat + ',' + lng + '&radius=1000&key=' + config.GOOGLE_API_KEY;
	request({
		uri: google_map_api_url,
		method: "GET",
		timeout: 10000
		}, function(err, response, body) {
			if(err) return callback(err);
			
			var google_places_here = JSON.parse(body);
			callback(null, {retcode: 0, results: google_places_here.results});
		});
}

init_radar_favourite = function(token, id, callback) {
	var user_id = jsonwebtoken.decode(token)._id;
	
	var statement = 'SELECT channels from "RadarFavourite" WHERE _user_id = \''+user_id+'\' AND _id = \''+id+'\'';
	db.query(statement, function(err, result) {
		if(err) return callback(err);
		
		var array_channels=[];
		var i = 0, len = result.rows[0].channels.length;
		while(i < len) {
			array_channels.push(result.rows[0].channels[i]);
			i++;
		}
		callback(null, {retcode: 0, channels: array_channels});
	});
}

init_radar_world = function(token, callback) {

}

create_radar_favourite = function(token, name, channels, geoloc, callback) {
	var user_id = jsonwebtoken.decode(token)._id;
	
	var i=0;
	var array_channel = '{';
	while(i <channels.length - 1  && i < config.MAX_CHANNELS_PER_FAVOURITE_RADAR) {
		array_channel += '"'+channels[i]+'",';
		i++;
	}
	array_channel += '"'+channels[i]+'"}';
		
	var statement = 'INSERT INTO "RadarFavourite"(_user_id, fav_name, channels) VALUES(\''+ user_id +'\',\''+ name +'\',\''+ array_channel +'\') RETURNING _id, fav_name';
	db.query(statement, function(err, result) {
		if(err) return callback(err);
		
		var id = result.rows[0]._id;
		var name = result.rows[0].fav_name;

		callback(null, {retcode: 0, fav : {id : id, n : name}});
	});
}

/*********************************************

**********************************************/
create_post = function(token, channels, content, photos, callback) {
	var content = (typeof content != 'undefined') ? content : "";
	var user_id = jsonwebtoken.decode(token)._id, avatar = jsonwebtoken.decode(token).avatar, nickname = jsonwebtoken.decode(token).nickname;
	var array_channel = '{'+channels+'}';
	
	var array_photos = '{';
	var i = 0;
	if(typeof photos === 'undefined') {
		array_photos += '}';
	} else {
		while(i <photos.length - 1 ) {
			array_photos += '"'+photos[i]+'",';
			i++;
		}		
		array_photos += '"'+photos[i]+'"}';
	}	
	console.log(JSON.stringify(photos));
	
	var statement = 'INSERT INTO "Post"( content, _user_id, expired_duration, channels, photos) VALUES(\''+ content +'\','+user_id+', 5*60, \''+array_channel+'\', \''+array_photos+'\' ) RETURNING _id, create_time';
	db.query(statement, function(err, result) {
		if(err) return callback(err);
		
		var id = result.rows[0]._id, create_time = result.rows[0].create_time;
		var channel = channels[0];
		
		statement = 'INSERT INTO "Relay"(_id,_entity_id, _user_id, channel ) VALUES((select coalesce(MAX(_id),0) FROM "Relay" where _entity_id = '+id+') + 1,\''+ id +'\',\''+ user_id +'\', \''+channel+'\')';
		db.query(statement, function(err, result) {
			if(err) return callback(err);
			
			var msg = {'new' : true, 'type' : 0};					
			msg.id = id;
			msg.owner = {};
			msg.owner.id = user_id;
			msg.owner.nickname = nickname;
			msg.owner.avatar = avatar;
			msg.content = content;
			msg.metadata = {};
			msg.metadata.create_time = create_time;
			msg.i = {};
			msg.i.l = 0;
			msg.i.c = 0;
			msg.i.r = 0;
			msg.orgin = channel;
			msg.is_photos = (typeof photos !== 'undefined') ? true : false;
			
			var i=0;
			while(i < channels.length) {
				var no_c = no_l = no_r = 0;
				pubsub.publish(channels[i], msg);
				i++;
			}

			callback(null, {retcode: 0, id: id});
		});
	});
}

create_post_photos = function(token, channels, content, photos, callback) {

}

create_post_question = function(token, channels, content, callback) { // question type
	var content = (typeof content != 'undefined') ? content : "";
	var user_id = jsonwebtoken.decode(token)._id, avatar = jsonwebtoken.decode(token).avatar, nickname = jsonwebtoken.decode(token).nickname;
	var array_channel = '{'+channels+'}';
	
	var statement = 'INSERT INTO "Post"( content, _user_id, expired_duration, channels, type) VALUES(\''+ content +'\','+user_id+', 5*60, \''+array_channel+'\', 1 ) RETURNING _id, create_time';
	db.query(statement, function(err, result) {
		if(err) return callback(err);
		
		var id = result.rows[0]._id, create_time = result.rows[0].create_time;
		var channel = channels[0];
		
		statement = 'INSERT INTO "Relay"(_id,_entity_id, _user_id, channel ) VALUES((select coalesce(MAX(_id),0) FROM "Relay" where _entity_id = '+id+') + 1,\''+ id +'\',\''+ user_id +'\', \''+channel+'\')';
		db.query(statement, function(err, result) {
			if(err) return callback(err);
			
			var msg = {'new' : true, 'type' : 1};	// type = 1 for Post_type = question.				
			msg.id = id;
			msg.owner = {};
			msg.owner.id = user_id;
			msg.owner.nickname = nickname;
			msg.owner.avatar = avatar;
			msg.content = content;
			msg.metadata = {};
			msg.metadata.create_time = create_time;
			msg.i = {};
			msg.i.l = 0;
			msg.i.c = 0;
			msg.i.r = 0;
			msg.orgin = channel;
			msg.is_photos = (typeof photos !== 'undefined') ? true : false;
			
			var i=0;
			while(i < channels.length) {
				var no_c = no_l = no_r = 0;
				pubsub.publish(channels[i], msg);
				i++;
			}

			callback(null, {retcode: 0, id: id});
		});
	});
}

create_post_like = function(token, id, callback) {
	var user_id = jsonwebtoken.decode(token)._id, nickname = jsonwebtoken.decode(token).nickname, avatar = jsonwebtoken.decode(token).avatar;
	var statement = 'INSERT INTO "Like"(_id,_entity_id, _user_id ) VALUES((select coalesce(MAX(_id),0) FROM "Like" where _entity_id = '+id+') + 1,\''+ id +'\',\''+ user_id +'\') RETURNING (select _user_id owner_id from "Post" where _id = '+id+'), (select array_accum( distinct channel) channels from "Relay" where _entity_id = '+id+' ), (select count(_id) no_like from "Like" where _entity_id = '+id+')';
	db.query(statement, function(err, result) {
		if(err) return callback(err);
		
		var owner_id = result.rows[0].owner_id, no_like = result.rows[0].no_like, channels = result.rows[0].channels;
		Notification_util.alert(owner_id, {id: user_id, nickname: nickname, avatar: avatar}, 'like your' , {id: id, name : 'post', type : 1});

		if(no_like == 10 || no_like == 99) { // this is to control the broadcast of no_like <-- need to think about it again.
			var i=0;
			while(i < channels.length) {
				var msg = {'new':false,'type':1,'id':id,'i':{'lk':no_like}};
				pubsub.publish(channels[i], msg);
				i++;
			}	
		} else {
			//console.log('Wait until 10 like to broadcast');
		}			
		
		callback(null, {retcode: 0});
	});
}

create_post_thank_answer = function(token, post_id, answer_id, callback) { // for question type
	var user_id = jsonwebtoken.decode(token)._id;
	var statement = 'UPDATE "Post" SET _answer_id='+answer_id+' WHERE _user_id = \''+user_id+'\' AND _id = ' + post_id + ' RETURNING (select array_accum( distinct channel) channels from "Relay" where _entity_id = '+post_id+' ), (select c._user_id answer_ownser_id, u.nickname answer_owner_nickname, i.avatar answer_owner_avatar, c.content answer_content from "comment" c,"user" u where c._id = '+answer_id+' AND c._user_id = u._id)';
	db.query(statement, function(err, result) {
		if(err) return callback(err);
		
		var answer_owner_id = result.rows[0].answer_owner_id, answer_owner_nickname = result.rows[0].answer_owner_nickname, answer_owner_avatar = result.rows[0].answer_owner_avatar, answer_content = result.rows[0].answer_content, channels = result.rows[0].channels;
		var i=0;
		while(i < channels.length) {
			var msg = {'new':false, 'id':post_id,'tks':{'id' : answer_id, 'owner' : {'id' : answer_owner_id, 'nickname' : answer_owner_nickname, 'avatar' : answer_owner_avatar} , 'content' : answer_content}};
			pubsub.publish(channels[i], msg);
			i++;
		}
		
		callback(null, {retcode: 0});
	});
}

create_post_comment = function(token, id, content, callback) {
	var user_id = jsonwebtoken.decode(token)._id, nickname = jsonwebtoken.decode(token).nickname, avatar = jsonwebtoken.decode(token).avatar;
	var statement = 'INSERT INTO "Comment"(_id,_entity_id, _user_id, content ) VALUES((select coalesce(MAX(_id),0) FROM "Comment" where _entity_id = '+id+') + 1,\''+ id +'\',\''+ user_id +'\', \''+content+'\') RETURNING _id, create_time,(select _user_id owner_id from "Post" where _id = '+id+'),(select array_accum( distinct channel) channels from "Relay" where _entity_id = '+id+' ), (select count(_id) no_comment from "Comment" where _entity_id = '+id+')';
	db.query(statement, function(err, result) {
		if(err) return callback(err);
		
		var owner_id = result.rows[0].owner_id, no_comment = result.rows[0].no_comment, channels = result.rows[0].channels;
		Notification_util.alert(owner_id, {id:user_id, nickname:nickname, avatar: avatar}, 'comment your' , {id: id, name : 'post', type : 1});
		
		if(no_comment == 10 || no_comment == 99) { // this is to control the broadcast of comment <-- need to think about it again.
			var i=0;		
			while(i < channels.length) {
				var msg = {'new':false,'type':1,'id':id,'i':{'c':no_comment}};
				pubsub.publish(channels[i], msg);
				i++;
			}
		} else {
			//console.log('Wait until 10 comments to broadcast');
		}
		
		var temp = {};
		temp.id = result.rows[0]._id;
		temp.owner = {};
		temp.owner.id = user_id;
		temp.owner.nickname = nickname;
		temp.owner.avatar = avatar;
		temp.content = content;
		temp.metadata = {};
		temp.metadata.create_time = result.rows[0].create_time;
		temp.i = {};
		temp.i.l = 0;
			
		callback(null, {retcode: 0, content : temp});
	});
}

create_question_answer = function(token, id, content, callback) {
	var user_id = jsonwebtoken.decode(token)._id, nickname = jsonwebtoken.decode(token).nickname, avatar = jsonwebtoken.decode(token).avatar;
	var statement = 'INSERT INTO "Comment"(_id,_entity_id, _user_id, content ) VALUES((select coalesce(MAX(_id),0) FROM "Comment" where _entity_id = '+id+') + 1,\''+ id +'\',\''+ user_id +'\', \''+content+'\') RETURNING _id, create_time,(select _user_id owner_id from "Post" where _id = '+id+'),(select array_accum( distinct channel) channels from "Relay" where _entity_id = '+id+' ), (select count(_id) no_comment from "Comment" where _entity_id = '+id+')';
	db.query(statement, function(err, result) {
		if(err) return callback(err);
		
		var owner_id = result.rows[0].owner_id, no_comment = result.rows[0].no_comment, channels = result.rows[0].channels;
		Notification_util.alert(owner_id, {id:user_id, nickname:nickname, avatar: avatar}, 'answer your' , {id: id, name : 'question', type : 1});
		
		if(no_comment == 10 || no_comment == 99) { // this is to control the broadcast of comment <-- need to think about it again.
			var i=0;		
			while(i < channels.length) {
				var msg = {'new':false,'type':1,'id':id,'i':{'c':no_comment}};
				pubsub.publish(channels[i], msg);
				i++;
			}
		} else {
			//console.log('Wait until 10 comments to broadcast');
		}
		
		var temp = {};
		temp.id = result.rows[0]._id;
		temp.owner = {};
		temp.owner.id = user_id;
		temp.owner.nickname = nickname;
		temp.owner.avatar = avatar;
		temp.content = content;
		temp.metadata = {};
		temp.metadata.create_time = result.rows[0].create_time;
		temp.i = {};
		temp.i.l = 0;
			
		callback(null, {retcode: 0, content : temp});
	});
}


create_post_relay = function(token, id, channel, callback) {
	var user_id = jsonwebtoken.decode(token)._id, nickname = jsonwebtoken.decode(token).nickname, avatar = jsonwebtoken.decode(token).avatar;
	var statement = 'INSERT INTO "Relay"(_id,_entity_id, _user_id, channel ) VALUES((select coalesce(MAX(_id),0) FROM "Relay" where _entity_id = '+id+') + 1,\''+ id +'\',\''+ user_id +'\', \''+channel+'\') RETURNING (select _user_id owner_id from "Post" where _id = '+id+'),(select count(_id) count_channel from "Relay" where _entity_id = '+id+' AND channel like \''+channel+'\'), (select array_accum( distinct channel) channels from "Relay" where _entity_id = '+id+' ), (select count(_id) no_relay from "Relay" where _entity_id = '+id+')';
	console.log(statement );
	db.query(statement, function(err, result) {
		if(err) return callback(err);
		
		var owner_id = result.rows[0].owner_id, no_relay = result.rows[0].no_realy, channels = result.rows[0].channels, count_channel = result.rows[0].count_channel;
		Notification_util.alert(owner_id, {id:user_id, nickname: nickname, avatar: avatar}, 'relay your' , {id: id, name : 'post', type : 1});
		
		if(no_relay == 10 || no_relay == 99) { // this is to control the broadcast of no_relay <-- need to think about it again.
			var i=0;
			while(i < channels.length) {	
				var msg = {'new':false,'id':id,'i':{'r':no_relay}};
				pubsub.publish(channels[i], msg);
				i++;
			}			
		}
		
		callback(null, {retcode: 0});
		console.log(JSON.stringify(channels) + "-"+ count_channel);
		if(count_channel <= 1){ // first time relay on this channel - hence broadcast
			var statement = 'SELECT p._id pid, u._id uid, u.nickname, u.avatar, p.content, p.create_time, p.n_view, p.type t, p.channels, p.photos, '
						+'c._id c_id, c._user_id c_owner_id, uu.nickname c_owner_nickname, uu.avatar c_owner_avatar, c.content c_content, '
						+'(select count(c._id) from "Comment" c where c._entity_id = p._id) as no_comment, '
						+'(select count(l._id) from "Like" l where l._entity_id = p._id) as no_like, '
						+'(select count(r._id) from "Relay" r where r._entity_id = p._id) as no_relay '
							+'FROM "User" u INNER JOIN "Post" p LEFT JOIN "User" uu JOIN "Comment" c ON (uu._id = c._user_id) '
							+'ON (p._answer_id = c._id AND p._id = c._entity_id) ON (p._user_id = u._id) '
							+'WHERE  p._user_id = u._id AND p._id = '+id;
			db.query(statement, function(err, result) {
				if(err) return callback(err);
				
					var i = 0;
					if( i < result.rows.length) {
						var msg = {'new' : true};
						msg.type = result.rows[i].t === null? 0 : result.rows[i].t;
						msg.id = result.rows[i].pid;
						msg.owner = {};
						msg.owner.id = result.rows[i].uid;
						msg.owner.nickname = result.rows[i].nickname;
						msg.owner.avatar = result.rows[i].avatar;
						msg.content = result.rows[i].content;
						msg.metadata = {};
						msg.metadata.create_time = result.rows[i].create_time;
						msg.i = {};
						msg.i.l = parseInt(result.rows[i].no_like);
						msg.i.c = parseInt(result.rows[i].no_comment);
						msg.i.r = parseInt(result.rows[i].no_relay - 1);
						msg.orgin = result.rows[i].channels[0];
						msg.is_photos = (result.rows[i].photos != null && result.rows[i].photos.length > 0) ? true : false;
						if(result.rows[i].c_id != null) {
							//"tks":{"id" : answer_id, "owner" : {"id" : answer_owner_id, "nickname" : answer_owner_nickname, "avatar" : answer_owner_avatar} , "content" : answer_content}
							msg.tks = {};
							msg.tks.id = result.rows[i].c_id;
							msg.tks.owner = {};
							msg.tks.owner.id = result.rows[i].c_owner_id;
							msg.tks.owner.nickname = result.rows[i].c_owner_nickname;
							msg.tks.owner.avatar = result.rows[i].c_owner_avatar;
							msg.tks.content = result.rows[i].c_content;
						}
					}
					
					pubsub.publish(channel, msg);
			});
		}
	});
}

create_comment_comment = function(token, callback) {
	var statement = '';
	db.query(statement, function(err, result) {
		if(err) return callback(err);
		
		callback(null, {retcode: 0});
	});
}

create_comment_like = function(token, callback) {
	var statement = '';
	db.query(statement, function(err, result) {
		if(err) return callback(err);
		
		callback(null, {retcode: 0});
	});
}

//---------------------------------//

remove_post = function(token, callback) {
	var statement = '';
	db.query(statement, function(err, result) {
		if(err) return callback(err);
		
		callback(null, {retcode: 0});
	});
}

remove_post_like = function(token, callback) {
	var statement = '';
	db.query(statement, function(err, result) {
		if(err) return callback(err);
		
		callback(null, {retcode: 0});
	});
}

remove_post_comment = function(token, callback) {
	var statement = '';
	db.query(statement, function(err, result) {
		if(err) return callback(err);
		
		callback(null, {retcode: 0});
	});
}

remove_comment_comment = function(token, callback) {
	var statement = '';
	db.query(statement, function(err, result) {
		if(err) return callback(err);
		
		callback(null, {retcode: 0});
	});
}

remove_comment_like = function(token, callback) {
	var statement = '';
	db.query(statement, function(err, result) {
		if(err) return callback(err);
		
		callback(null, {retcode: 0});
	});
}

/*********************************************

**********************************************/
get_post_list = function(token, channels, from_id, callback) { // by current location (channels)
	var user_id = jsonwebtoken.decode(token)._id;
	var current_channel = channels[0];
	var channels_condition = ' channel like \''+channels[0]+'\'';
	for(var i = 1; i < channels.length; i ++) {
		channels_condition+=' OR' + ' channel like \''+channels[i]+'\'';
	}
	var from_id_condition = '';
	if(from_id > 0) {
		from_id_condition = ' AND p._id < ' + from_id;
	}
	//var statement = 'SELECT p._id pid, u._id uid, u.nickname, u.avatar, p.content, p.create_time, p.n_view,(select count(c._id) from "Comment" c where c._entity_id = p._id) as no_comment, (select count(l._id) from "Like" l where l._entity_id = p._id) as no_like, (select count(r._id) from "Relay" r where r._entity_id = p._id) as no_relay FROM "Post" p,"User" u WHERE  p._user_id = u._id AND p._id IN (SELECT distinct _entity_id FROM "Relay" WHERE' + channels_condition + ')';
	var statement = 'SELECT p._id pid, u._id uid, u.nickname, u.avatar, p.content, p.create_time, p.n_view, p.type t, p.channels, p.photos, '
						+'c._id c_id, c._user_id c_owner_id, uu.nickname c_owner_nickname, uu.avatar c_owner_avatar, c.content c_content, '
						+'(select count(c._id) from "Comment" c where c._entity_id = p._id) as no_comment, '
						+'(select count(l._id) from "Like" l where l._entity_id = p._id) as no_like, '
						+'(select count(r._id) from "Relay" r where r._entity_id = p._id) as no_relay, '
						+'(select count(l._id) from "Like" l where l._entity_id = p._id AND l._user_id = '+user_id+') as no_my_like, '
						+'(select count(r._id) from "Relay" r where r._entity_id = p._id AND r._user_id = '+user_id+') as no_my_relay '
						//+'(select count(r._id) from "Relay" r where r._entity_id = p._id AND r.channel = \''+current_channel+'\') as no_current_channel '
							+'FROM "User" u INNER JOIN "Post" p LEFT JOIN "User" uu JOIN "Comment" c ON (uu._id = c._user_id) '
							+'ON (p._answer_id = c._id AND p._id = c._entity_id) ON (p._user_id = u._id) '
							+'WHERE p._id IN (SELECT distinct _entity_id FROM "Relay" WHERE' + channels_condition + ')' + from_id_condition
							+ ' ORDER BY p._id DESC LIMIT 10';
	
	/*var statement = 'SELECT p._id pid, u._id uid, u.nickname, u.avatar, p.content, p.create_time, p.n_view, p.type t, p.channels, p.photos '
						+'(select count(c._id) from "Comment" c where c._entity_id = p._id) as no_comment, '
						+'(select count(l._id) from "Like" l where l._entity_id = p._id) as no_like, '
						+'(select count(r._id) from "Relay" r where r._entity_id = p._id) as no_relay, '
						+'(select count(l._id) from "Like" l where l._entity_id = p._id AND l._user_id = '+user_id+') as no_my_like, '
						+'(select count(r._id) from "Relay" r where r._entity_id = p._id AND r._user_id = '+user_id+') as no_my_relay '
						//+'(select count(r._id) from "Relay" r where r._entity_id = p._id AND r.channel = '+current_channel+') as no_current_channel '
							+'FROM "User" u INNER JOIN "Post" p ON (p._user_id = u._id) '
							+'WHERE p._id IN (SELECT distinct _entity_id FROM "Relay" WHERE' + channels_condition + ')' + from_id_condition
							+ ' ORDER BY p._id DESC LIMIT 10';*/
							
	db.query(statement, function(err, result) {
		if(err) return callback(err);
		
		var i = 0;
		var post_list = [];
		while( i < result.rows.length) {
			var msg = {'new' : true};
			msg.type = result.rows[i].t === null? 0 : result.rows[i].t;
			msg.id = result.rows[i].pid;
			msg.owner = {};
			msg.owner.id = result.rows[i].uid;
			msg.owner.nickname = result.rows[i].nickname;
			msg.owner.avatar = result.rows[i].avatar;
			msg.content = result.rows[i].content;
			msg.metadata = {};
			msg.metadata.create_time = result.rows[i].create_time;
			msg.i = {};
			msg.i.l = parseInt(result.rows[i].no_like);
			msg.i.c = parseInt(result.rows[i].no_comment);
			msg.i.r = parseInt(result.rows[i].no_relay - 1);
			msg.i.my_l = (parseInt(result.rows[i].no_my_like) === 0) ? false : true;
			msg.i.my_r = (parseInt(result.rows[i].no_my_relay) === 0) ? false : true;
			//msg.is_here = (parseInt(result.rows[i].no_current_channel) === 0) ? false : true;
			msg.orgin = result.rows[i].channels[0];
			msg.is_photos = (result.rows[i].photos != null && result.rows[i].photos.length > 0) ? true : false;
			if(result.rows[i].c_id != null) {
				//'tks':{'id' : answer_id, 'owner' : {'id' : answer_owner_id, 'nickname' : answer_owner_nickname, 'avatar' : answer_owner_avatar} , 'content' : answer_content}
				msg.tks = {};
				msg.tks.id = result.rows[i].c_id;
				msg.tks.owner = {};
				msg.tks.owner.id = result.rows[i].c_owner_id;
				msg.tks.owner.nickname = result.rows[i].c_owner_nickname;
				msg.tks.owner.avatar = result.rows[i].c_owner_avatar;
				msg.tks.content = result.rows[i].c_content;
			}
			post_list.push(msg);
			i++;
		} 
		callback(null, {retcode: 0, posts : post_list});
	});
}

get_post_list_by_channel = function(token, channel, from_id, callback) {
	var user_id = jsonwebtoken.decode(token)._id;
	var current_channel = channel;
	var channels_condition = ' p.channels @> ARRAY[\''+current_channel+'\']::character varying(64)[]';
	var from_id_condition = '';
	
	if(from_id > 0) {
		from_id_condition = ' AND p._id < ' + from_id;
	}
	//var statement = 'SELECT p._id pid, u._id uid, u.nickname, u.avatar, p.content, p.create_time, p.n_view,(select count(c._id) from "Comment" c where c._entity_id = p._id) as no_comment, (select count(l._id) from "Like" l where l._entity_id = p._id) as no_like, (select count(r._id) from "Relay" r where r._entity_id = p._id) as no_relay FROM "Post" p,"User" u WHERE  p._user_id = u._id AND p._id IN (SELECT distinct _entity_id FROM "Relay" WHERE' + channels_condition + ')';
	var statement = 'SELECT p._id pid, u._id uid, u.nickname, u.avatar, p.content, p.create_time, p.n_view, p.type t, p.channels, p.photos, '
						+'c._id c_id, c._user_id c_owner_id, uu.nickname c_owner_nickname, uu.avatar c_owner_avatar, c.content c_content, '
						+'(select count(c._id) from "Comment" c where c._entity_id = p._id) as no_comment, '
						+'(select count(l._id) from "Like" l where l._entity_id = p._id) as no_like, '
						+'(select count(r._id) from "Relay" r where r._entity_id = p._id) as no_relay, '
						+'(select count(l._id) from "Like" l where l._entity_id = p._id AND l._user_id = '+user_id+') as no_my_like, '
						+'(select count(r._id) from "Relay" r where r._entity_id = p._id AND r._user_id = '+user_id+') as no_my_relay '
							+'FROM "User" u INNER JOIN "Post" p LEFT JOIN "User" uu JOIN "Comment" c ON (uu._id = c._user_id) '
							+'ON (p._answer_id = c._id AND p._id = c._entity_id) ON (p._user_id = u._id) '
							+'WHERE p._id IN (SELECT distinct _entity_id FROM "Relay" WHERE' + channels_condition + ')' + from_id_condition
							+ ' ORDER BY p._id DESC LIMIT 10';
	
	/*var statement = 'SELECT p._id pid, u._id uid, u.nickname, u.avatar, p.content, p.create_time, p.n_view, p.type t, p.channels, p.photos '
						+'(select count(c._id) from "Comment" c where c._entity_id = p._id) as no_comment, '
						+'(select count(l._id) from "Like" l where l._entity_id = p._id) as no_like, '
						+'(select count(r._id) from "Relay" r where r._entity_id = p._id) as no_relay, '
						+'(select count(l._id) from "Like" l where l._entity_id = p._id AND l._user_id = '+user_id+') as no_my_like, '
						+'(select count(r._id) from "Relay" r where r._entity_id = p._id AND r._user_id = '+user_id+') as no_my_relay '
						+'(select count(r._id) from "Relay" r where r._entity_id = p._id AND r.channel = '+current_channel+') as no_current_channel '
							+'FROM "User" u INNER JOIN "Post" p ON (p._user_id = u._id) '
							+'WHERE p._id IN (SELECT distinct _entity_id FROM "Relay" WHERE' + channels_condition + ')' + from_id_condition
							+ ' ORDER BY p._id DESC LIMIT 10';*/
							
	db.query(statement, function(err, result) {
		if(err) return callback(err);
		
		var i = 0;
		var post_list = [];
		while( i < result.rows.length) {
			var msg = {'new' : true};
			msg.type = result.rows[i].t === null? 0 : result.rows[i].t;
			msg.id = result.rows[i].pid;
			msg.owner = {};
			msg.owner.id = result.rows[i].uid;
			msg.owner.nickname = result.rows[i].nickname;
			msg.owner.avatar = result.rows[i].avatar;
			msg.content = result.rows[i].content;
			msg.metadata = {};
			msg.metadata.create_time = result.rows[i].create_time;
			msg.i = {};
			msg.i.l = parseInt(result.rows[i].no_like);
			msg.i.c = parseInt(result.rows[i].no_comment);
			msg.i.r = parseInt(result.rows[i].no_relay - 1);
			msg.i.my_l = (parseInt(result.rows[i].no_my_like) === 0) ? false : true;
			msg.i.my_r = (parseInt(result.rows[i].no_my_relay) === 0) ? false : true;
			msg.is_here = (parseInt(result.rows[i].no_current_channel) === 0) ? false : true;
			msg.is_orgin = (current_channel == result.rows[i].channels[0]) ? true : false;
			msg.is_photos = (result.rows[i].photos.length > 0) ? true : false;
			if(result.rows[i].c_id != null) {
				//'tks':{'id' : answer_id, 'owner' : {'id' : answer_owner_id, 'nickname' : answer_owner_nickname, 'avatar' : answer_owner_avatar} , 'content' : answer_content}
				msg.tks = {};
				msg.tks.id = result.rows[i].c_id;
				msg.tks.owner = {};
				msg.tks.owner.id = result.rows[i].c_owner_id;
				msg.tks.owner.nickname = result.rows[i].c_owner_nickname;
				msg.tks.owner.avatar = result.rows[i].c_owner_avatar;
				msg.tks.content = result.rows[i].c_content;
			}
			post_list.push(msg);
			i++;
		} 
		callback(null, {retcode: 0, posts : post_list});
	});
}

get_post_detail = function(token, id, callback) {
	var user_id = jsonwebtoken.decode(token)._id;
	var statement = 'SELECT p._id pid, p.type t, u._id uid, u.nickname, u.avatar, p.content, p.create_time, p.n_view, p.photos, '+
	'(select count(c._id) from "Comment" c where c._entity_id = p._id) as no_comment, '+
	'(select count(l._id) from "Like" l where l._entity_id = p._id) as no_like, '+
	'(select count(r._id) from "Relay" r where r._entity_id = p._id) as no_relay, '+
	'(select count(l._id) from "Like" l where l._entity_id = p._id AND l._user_id = '+user_id+') as no_my_like, ' +
	'(select count(r._id) from "Relay" r where r._entity_id = p._id AND r._user_id = '+user_id+') as no_my_relay ' +
	'FROM "Post" p,"User" u WHERE p._id = \''+id+'\' AND p._user_id = u._id';
	db.query(statement, function(err, result) {
		if(err) return callback(err);
		
		var i=0;
		if( 0 < result.rows.length) {
			var temp = {'new' : true};
			temp.type = result.rows[i].t === null? 0 : result.rows[i].t;
			temp.id = result.rows[i].pid;
			temp.owner = {};
			temp.owner.id = result.rows[i].uid;
			temp.owner.nickname = result.rows[i].nickname;
			temp.owner.avatar = result.rows[i].avatar;
			temp.content = result.rows[i].content;
			temp.photos = result.rows[i].photos;
			temp.metadata = {};
			temp.metadata.create_time = result.rows[i].create_time;
			temp.i = {};
			temp.i.l = parseInt(result.rows[i].no_like);
			temp.i.c = parseInt(result.rows[i].no_comment);
			temp.i.r = parseInt(result.rows[i].no_relay - 1);
			temp.i.my_l = (parseInt(result.rows[i].no_my_like) === 0) ? false : true;
			temp.i.my_r = (parseInt(result.rows[i].no_my_relay) === 0) ? false : true;
		} 
		callback(null, {retcode: 0, post_detail : temp});
	});
}

get_post_comment_list = function(token, id, callback) {
	var statement = 'SELECT c._id, c.content, c.create_time, u._id as uid, u.nickname, u.avatar , coalesce(array_length(c.likes,1),0) no_like  FROM "Comment" c JOIN "User" u ON (c._user_id = u._id) WHERE _entity_id = ' + id + ' ORDER BY c._id DESC';
	db.query(statement, function(err, result) {
		if(err) return callback(err);
		
		var comment_list = [];
		var i = 0;
		while( i < result.rows.length) {
			var temp = {};
			temp.id = result.rows[i]._id;
			temp.owner = {};
			temp.owner.id = result.rows[i].uid;
			temp.owner.nickname = result.rows[i].nickname;
			temp.owner.avatar = result.rows[i].avatar;
			temp.content = result.rows[i].content;
			temp.metadata = {};
			temp.metadata.create_time = result.rows[i].create_time;
			temp.i = {};
			temp.i.l = result.rows[i].no_like;
			
			comment_list.unshift(temp);
			i++;
		} 
		
		callback(null, {retcode: 0, comments : comment_list});
	});
}

get_comment_comment = function(token, callback) {
	var statement = '';
	db.query(statement, function(err, result) {
		if(err) return callback(err);
		
		callback(null, {retcode: 0});
	});
}

/*********************************************

**********************************************/
get_profile_header = function(token, id, callback) { // list all badge
	var statement = 'SELECT nickname, fullname, avatar, is_verified FROM "User" u LEFT JOIN "UserProfile" up ON (u._id = up._id) WHERE u._id =' + id;
	db.query(statement, function(err, result) {
		if(err) return callback(err);
		
		var i = 0;
		var temp = {};
		if( i < result.rows.length) {
			temp.id = id;
			temp.nickname = result.rows[i].nickname;
			temp.fullname = result.rows[i].fullname;
			temp.avatar = result.rows[i].avatar;
			temp.is_verified = result.rows[i].is_verified;
		}
		
		callback(null, {retcode: 0, profile : temp});
	});
}

get_profile_post_list = function(token, id, from_id, callback) {	
	var from_id_condition = '';
	if(from_id > 0) {
		from_id_condition = ' AND p._id < ' + from_id;
	}
	
	var statement = 'SELECT p._id pid, p.type t, p._user_id uid, p.content, p.create_time, p.n_view,'+
	'(select count(c._id) from "Comment" c where c._entity_id = p._id) as no_comment, '+
	'(select count(l._id) from "Like" l where l._entity_id = p._id) as no_like, '+
	'(select count(r._id) from "Relay" r where r._entity_id = p._id) as no_relay '+
	'FROM "Post" p  WHERE p._user_id = ' + id + from_id_condition + ' ORDER BY pid DESC LIMIT 3';
	
	
	db.query(statement, function(err, result) {
		if(err) return callback(err);
		
		var i = 0;
		var post_list = [];
		while( i < result.rows.length) {
			var msg = {'new' : true};
			msg.type = result.rows[i].t === null? 0 : result.rows[i].t;
			msg.id = result.rows[i].pid;
			msg.content = result.rows[i].content;
			msg.metadata = {};
			msg.metadata.create_time = result.rows[i].create_time;
			msg.i = {};
			msg.i.l = parseInt(result.rows[i].no_like);
			msg.i.c = parseInt(result.rows[i].no_comment);
			msg.i.r = parseInt(result.rows[i].no_relay - 1);

			post_list.push(msg);
			i++;
		}
		
		callback(null, {retcode: 0, post_list : post_list});
	});
}

get_profile_detail = function(token, callback) {
	var statement = '';
	db.query(statement, function(err, result) {
		if(err) return callback(err);
		
		callback(null, {retcode: 0});
	});
}

get_profile_contact = function(token, callback) {
	var statement = '';
	db.query(statement, function(err, result) {
		if(err) return callback(err);
		
		callback(null, {retcode: 0});
	});
}

get_profile_other_info = function(token, callback) {
	var statement = '';
	db.query(statement, function(err, result) {
		if(err) return callback(err);
		
		callback(null, {retcode: 0});
	});
}

/*********************************************
Notification Services
**********************************************/
notification_list = function(token, callback) {
	var user_id = jsonwebtoken.decode(token)._id;
	var statement = 'SELECT n._id,subject, verb, object, n.type, p.content o_c FROM "Notification" n, "Post" p WHERE user_id = \''+user_id+'\' AND (n.ts > now() - interval \'15 days\') AND cast( n.object->>\'id\' as int) = p._id ORDER BY n._id ASC LIMIT 20';
	db.query(statement, function(err, result) {
		if(err) return callback(err);
		
		var notification_list = [];
		var i = 0;
		while( i < result.rows.length) {
			var temp = {};
			temp.id = result.rows[i]._id;
			temp.s = result.rows[i].subject;
			temp.v = result.rows[i].verb;
			temp.o = result.rows[i].object;
			temp.t = result.rows[i].type;
			temp.c = result.rows[i].o_c;
			
			notification_list.push(temp);
			i++;
		} 
		
		callback(null, {retcode: 0, list : notification_list});
	});
}

notification_view = function(token, id, callback) {
	var user_id = jsonwebtoken.decode(token)._id;
	var statement = 'UPDATE "Notification" SET viewed=TRUE WHERE user_id = \''+user_id+'\' AND _id = ' + id;
	db.query(statement, function(err, result) {
		if(err) return callback(err);
		
		callback(null, {retcode: 0});
	});
}

var Notification_util = function() {
	function alert(owner_id, subject, verb, object) { // subject: | verb: comment, like, relay -  | object Post(&question)
		if(subject.id == owner_id) {
			return;
		}
		var statement = 'INSERT INTO "Notification"(_id, user_id, subject, verb, object, type) VALUES ((select coalesce(MAX(_id),0) FROM "Notification" where user_id = '+owner_id+') + 1,'+owner_id+', \''+JSON.stringify(subject)+'\', \''+verb+'\', \''+JSON.stringify(object)+'\', 0) RETURNING _id';
		db.query(statement, function(err, result) {
			if(err) return;
			
			var temp = {};
			temp.id = result.rows[0]._id;
			temp.s = subject;
			temp.v = verb;
			temp.o = object;
			temp.t = 0;
			pubsub.publish(owner_id, temp);	
		});
	}
	
	return  {		
		//notify_request : notify_request,
		//notify_invite : notify_invite,
		alert : alert // type = 0
	}	
}();

/***************** me ************************

**********************************************/
get_my_profile_header = function(token, callback) { // list all badge
	var id = jsonwebtoken.decode(token)._id;
	var statement = 'SELECT nickname, fullname, avatar, is_verified FROM "User" u LEFT JOIN "UserProfile" up ON (u._id = up._id) WHERE u._id =' + id;
	
	db.query(statement, function(err, result) {
		if(err) return callback(err);
		
		var i = 0;
		var temp = {};
		if( i < result.rows.length) {
			temp.id = id;
			temp.nickname = result.rows[i].nickname;
			temp.fullname = result.rows[i].fullname;
			temp.avatar = result.rows[i].avatar;
			temp.is_verified = result.rows[i].is_verified;
		}
		
		callback(null, {retcode: 0, profile : temp});
	});
}

get_my_post_list = function(token, from_id, callback) {
	var id = jsonwebtoken.decode(token)._id;
	var from_id_condition = '';
	if(from_id > 0) {
		from_id_condition = ' AND p._id < ' + from_id;
	}
	var statement = 'SELECT p._id pid, p.type t, p._user_id uid, p.content, p.create_time, p.n_view,'+
	'(select count(c._id) from "Comment" c where c._entity_id = p._id) as no_comment, '+
	'(select count(l._id) from "Like" l where l._entity_id = p._id) as no_like, '+
	'(select count(r._id) from "Relay" r where r._entity_id = p._id) as no_relay, '+
	'(select count(l._id) from "Like" l where l._entity_id = p._id AND l._user_id = '+id+') as no_my_like '+
	'FROM "Post" p  WHERE p._user_id = ' + id + from_id_condition + ' ORDER BY pid DESC LIMIT 3';
	
	
	db.query(statement, function(err, result) {
		if(err) return callback(err);
		
		var i = 0;
		var post_list = [];
		while( i < result.rows.length) {
			var msg = {'new' : true};
			msg.type = result.rows[i].t === null? 0 : result.rows[i].t;
			msg.id = result.rows[i].pid;
			msg.content = result.rows[i].content;
			msg.metadata = {};
			msg.metadata.create_time = result.rows[i].create_time;
			msg.i = {};
			msg.i.l = parseInt(result.rows[i].no_like);
			msg.i.c = parseInt(result.rows[i].no_comment);
			msg.i.r = parseInt(result.rows[i].no_relay - 1);
			msg.i.my_l = (result.rows[i].no_my_like > 0) ? true : false;
			post_list.push(msg);
			i++;
		}
		
		callback(null, {retcode: 0, post_list : post_list});
	});
}

//////////////////////

_update_password = function(id, hash_password, callback) {
	var statement = 'UPDATE "User" set "password" = \''+hash_password+'\' WHERE _id = '+id;
	db.query(statement, function(err, result) {
		if(err) return callback(err);

		callback(null, result);
	});
}

change_my_password = function(token, old_password, new_password, callback) {
	var id = jsonwebtoken.decode(token)._id,
	nickname = jsonwebtoken.decode(token).nickname,
	avatar = jsonwebtoken.decode(token).avatar;
	
	var statement = 'SELECT "_id", "nickname", "avatar","password" from "User" WHERE _id = \''+id+'\'';
	db.query(statement, function(err, result) {
		if(err) return callback(err);

		if(result.rows.length > 0) { // SIGN IN. check password. 				
			if(hash.verify(old_password, result.rows[0].password)) { // old_password correct. now update new_password & return new token
				var hash_password = hash.generate(new_password);
				_update_password(id, hash_password, function(err, result) {
					if(err) return callback(err);
					
					console.log(JSON.stringify(result));
					var token = jsonwebtoken.sign({ _id: id, nickname : nickname, avatar : avatar}, config.JWT_SECRET);
					callback(null, {retcode: 0, token : token, avatar : avatar, nickname : nickname});
				});
			} else {	// wrong old_password.
				console.log('wrong old_password.');
				callback(null, {retcode: -1});
			}
		} else { // _id not exist - very rare & strange
			console.log('_id not exist - very rare & strange');
			callback(null, {retcode: -1});
		}
	});
}

change_my_basic_nickname = function(token, nickname, callback) {
	var table = "User",
	id = jsonwebtoken.decode(token)._id,
	avatar = jsonwebtoken.decode(token).avatar,
	array_fields = ["nickname"],
	array_values = [nickname];
	
	db.insert_or_update(table, id, array_fields, array_values, false, function(err, result) {
		if(err) return callback(err);
		
		var token = jsonwebtoken.sign({ _id: id, avatar : avatar, nickname : nickname}, config.JWT_SECRET);
		callback(null, {retcode: 0, token : token});
	});
}

change_my_basic_fullname = function(token, fullname, callback) {
	var table = "UserProfile",
	id = jsonwebtoken.decode(token)._id,
	array_fields = ["fullname"],
	array_values = [fullname];
	
	db.insert_or_update(table, id, array_fields, array_values, false, function(err, result) {
		if(err) return callback(err);
		
		callback(null, {retcode: 0});
	});
}

//////////////////////////////////////
module.exports = {
	signin : signin,
	signup_basic_nickname : signup_basic_nickname,
	signup_basic_avatar : signup_basic_avatar,
	signup_basic_fullname : signup_basic_fullname,
	init : init,
	init_radar_here : init_radar_here,
	init_radar_favourite : init_radar_favourite,
	init_radar_world : init_radar_world,
	create_radar_favourite : create_radar_favourite,
	create_post : create_post,
	create_post_question : create_post_question,
	create_post_like : create_post_like,
	create_post_comment : create_post_comment,
	create_question_answer : create_question_answer,
	create_post_relay : create_post_relay,
	create_comment_comment : create_comment_comment,
	create_comment_like : create_comment_like,
	remove_post : remove_post,
	remove_post_like : remove_post_like,
	remove_post_comment : remove_post_comment,
	remove_comment_comment : remove_comment_comment,
	remove_comment_like : remove_comment_like,
	get_post_list : get_post_list,
	get_post_list_by_channel : get_post_list_by_channel,
	get_post_detail : get_post_detail,
	get_post_comment_list : get_post_comment_list,
	get_comment_comment : get_comment_comment,
	
	get_profile_header: get_profile_header,
	get_profile_post_list: get_profile_post_list,
	
	notification_list : notification_list,
	notification_view : notification_view,
	
	get_my_profile_header :get_my_profile_header,
	get_my_post_list : get_my_post_list,
	change_my_password : change_my_password,
	change_my_basic_nickname : change_my_basic_nickname,
	change_my_basic_fullname : change_my_basic_fullname
}