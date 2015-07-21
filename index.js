var nex = require('./nex.js');
var config = require('./__config.js');
var pubsub = require('./__pubsub.js');
var logger = require('./__logging.js');

var util = require('util');
var express = require('express');
var bodyParser = require('body-parser');
var multer = require('multer'); 
var fs = require('fs'); 
var jsonwebtoken = require('jsonwebtoken');

var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);

///////////// express.js init ////////////////////////

app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public')); // for public folder
app.use(bodyParser.json({strict: false})); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

app.all('/', function(req, res, next) { // for cross domain allow
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  next();
 });

/////////////// Router/Controller ///////////////////////////

/*********************************************

**********************************************/
app.get('/signinup', function(req, res) {
	var email = req.query.email, password = req.query.password;
	
	nex.signin(email, password, function(err, result) {
		if(err) {
			res.jsonp('there is error');
		} else {
			res.jsonp(result);
		}
	});
});

app.post('/signup_basic_nickname', function(req, res){
	var id = req.body.id, nickname = req.body.nickname;
	
	nex.signup_basic_nickname(id, nickname, function(err, result) {
		if(err) {
			res.jsonp('there is error');
		} else {
			res.jsonp(result);
		}
	});
});

app.post('/signup_basic_fullname', function(req, res){
	var token = req.body.token, fullname = req.body.fullname;
	
	nex.signup_basic_fullname(token, fullname, function(err, result) {
		if(err) {
			res.jsonp('there is error');
		} else {
			res.jsonp(result);
		}
	});
});

app.post('/signup_basic_avatar', multer({
	dest: './public/avatar',
	changeDest: function(dest, req, res) {
		var newDestination = dest;
		var stat = null;
		try {
			stat = fs.statSync(newDestination);
		} catch (err) {
			fs.mkdirSync(newDestination);
		}
		if (stat && !stat.isDirectory()) {
			logger.error('Directory cannot be created because an inode of a different type exists at "' + newDestination + '"');
			//throw new Error('Directory cannot be created because an inode of a different type exists at "' + dest + '"');
		}
		return newDestination;
	}
}), function(req, res){
	var token = req.body.Token;
	logger.info('[POST]/signup_basic_avatar ({token : '+token+'})', 0);
        logger.log(req.body);

        var filesUploaded = 0;

        if ( Object.keys(req.files).length === 0 ) {
            console.log('no files uploaded');
        } else {
            console.log(req.files)

            var files = req.files.file;
            if (!util.isArray(req.files.file)) {
                files = [ req.files.file ];
            } 

            filesUploaded = files.length;
        }
	
	var avatar = files[0].name;
	nex.signup_basic_avatar(token, avatar, function(err, result) {
		if(err) {
			res.jsonp('there is error');
		} else {
			res.jsonp(result);
		}
	});
});

app.post('/signup_detail', function(req, res){

});

app.post('/signup_contact', function(req, res){

});

app.post('/signup_others', function(req, res){

}); 

app.get('/init', function(req, res) {
	var token = req.query.token, password = req.query.lat;
	
	nex.init(token, function(err, result) {
		if(err) {
			res.jsonp('there is error');
		} else {
			res.jsonp(result);
		}
	});
});

/*********************************************

**********************************************/
app.get('/init_radar_here', function(req, res) {
	var token = req.query.token, lng = req.query.lng, lat = req.query.lat;
	
	nex.init_radar_here(token, lat, lng, function(err, result) {
		if(err) {
			res.jsonp('there is error');
		} else {
			res.jsonp(result);
		}
	});
});

app.get('/init_radar_fovourite', function(req, res) {
	var token = req.query.token, id = req.query.id;
	
	nex.init_radar_fovourite(token, password, function(err, result) {
		if(err) {
			res.jsonp('there is error');
		} else {
			res.jsonp(result);
		}
	});
});
 
app.get('/init_radar_world', function(req, res) {

});
 
app.post('/create_radar_favourite', function(req, res) {
	var message = req.body;
	var name = message.Name, channels = message.Channels, geoloc =  { lat : message.lat, lon : message.lon}, token = message.Token;
	
	nex.create_radar_favourite(token, name, channels, geoloc, function(err, result) {
		if(err) {
			res.jsonp('there is error');
		} else {
			res.jsonp(result);
		}
	});
});

/*********************************************

**********************************************/
app.post('/upload_post_photo', multer({
	dest: './public',
	changeDest: function(dest, req, res) {
		var token = req.body.Token;
		var id = jsonwebtoken.decode(token)._id;
		var newDestination = dest + '/' + id;
		
		var stat = null;
		try {
			stat = fs.statSync(newDestination);
		} catch (err) {
			fs.mkdirSync(newDestination);
		}
		if (stat && !stat.isDirectory()) {
			logger.error('Directory cannot be created because an inode of a different type exists at "' + newDestination + '"');
			//throw new Error('Directory cannot be created because an inode of a different type exists at "' + dest + '"');
		}
		return newDestination;
	}
}), function(req, res){
	var token = req.body.Token;
	var id = jsonwebtoken.decode(token)._id;
	
        var filesUploaded = 0;

        if ( Object.keys(req.files).length === 0 ) {
            console.log('no files uploaded');
        } else {
            console.log(req.files)

            var files = req.files.file;
            if (!util.isArray(req.files.file)) {
                files = [ req.files.file ];
            } 

            filesUploaded = files.length;
        }
	
	var filename = files[0].name;
	res.jsonp({file :filename});
});

app.post('/create_post', function(req, res) {
	var message = req.body;
	var channels = [message.Channels], content = (typeof message.Content != 'undefined') ? message.Content : '', token = message.Token;
	var photos = message.photos;
	
	nex.create_post(token, channels, content, photos, function(err, result) {
		if(err) {
			res.jsonp('there is error');
		} else {
			res.jsonp(result);
		}
	});
});

app.post('/create_post_question', function(req, res) {
	var message = req.body;
	var channels = [message.Channels], content = (typeof message.Content != 'undefined') ? message.Content : '', token = message.Token;
	
	nex.create_post_question(token, channels, content, function(err, result) {
		if(err) {
			res.jsonp('there is error');
		} else {
			res.jsonp(result);
		}
	});
});

app.post('/create_post_like', function(req, res) {
	var message = req.body;
	var token = message.Token, id = message.id;
	
	nex.create_post_like(token, id, function(err, result) {
		if(err) {
			res.jsonp('there is error');
		} else {
			res.jsonp(result);
		}
	});
});

app.post('/create_post_comment', function(req, res) {
	var message = req.body;
	var token = message.Token, id = message.id, content = message.content;
	
	nex.create_post_comment(token, id, content, function(err, result) {
		if(err) {
			res.jsonp('there is error');
		} else {
			res.jsonp(result);
		}
	});
});

app.post('/create_question_answer', function(req, res) {
	var message = req.body;
	var token = message.Token, id = message.id, content = message.content;
	
	nex.create_question_answer(token, id, content, function(err, result) {
		if(err) {
			res.jsonp('there is error');
		} else {
			res.jsonp(result);
		}
	});
});

app.post('/create_post_relay', function(req, res) {
	var message = req.body;
	var token = message.Token, id = message.id, channel = message.channel;
	
	nex.create_post_relay(token, id, channel, function(err, result) {
		if(err) {
			res.jsonp('there is error');
		} else {
			res.jsonp(result);
		}
	});
});

app.post('/create_comment_comment', function(request, response) { // no need broadcast

});

app.post('/create_comment_like', function(request, response) { // no need broadcast. 

});

app.post('/remove_post_like', function(request, response) {

});

app.post('/remove_post_comment', function(request, response) {

});

app.post('/remove_comment_comment', function(request, response) {

});

app.post('/remove_comment_like', function(request, response) {

});

/*********************************************

**********************************************/

app.get('/get_post_list', function(req, res) {
	var token = req.query.token, channels = req.query.channels, from_id = req.query.from_id;
	
	nex.get_post_list(token, channels, from_id, function(err, result) {
		if(err) {
			res.jsonp('there is error');
		} else {
			res.jsonp(result);
		}
	});
});

app.get('/get_post_detail', function(req, res) {
	var token = req.query.token, id = req.query.id;
	nex.get_post_detail(token, id, function(err, result) {
		if(err) {
			res.jsonp('there is error');
		} else {
			res.jsonp(result);
		}
	});
});

app.get('/get_post_comment_list', function(req, res) {
	var token = req.query.token, id = req.query.id;
	nex.get_post_comment_list(token, id, function(err, result) {
		if(err) {
			res.jsonp('there is error');
		} else {
			res.jsonp(result);
		}
	});
});

app.get('/get_post_comment_comment', function(req, res) {

});

/*********************************************

**********************************************/

app.get('/get_profile_header', function(req, res) {
	var token = req.query.token, id = req.query.id;
	nex.get_profile_header(token, id, function(err, result) {
		if(err) {
			res.jsonp('there is error');
		} else {
			res.jsonp(result);
		}
	});
});

app.get('/get_profile_post_list', function(req, res) {
	var token = req.query.token, id = req.query.id, from_id = req.query.from_id;
	nex.get_profile_post_list(token, id, from_id, function(err, result) {
		if(err) {
			res.jsonp('there is error');
		} else {
			res.jsonp(result);
		}
	});
});



/*********************************************
me
**********************************************/

app.get('/get_my_profile_header', function(req, res) {
	var token = req.query.token;
	nex.get_my_profile_header(token, function(err, result) {
		if(err) {
			res.jsonp('there is error');
		} else {
			res.jsonp(result);
		}
	});
});

app.get('/get_my_post_list', function(req, res) {
	var token = req.query.token, from_id = req.query.from_id;
	nex.get_my_post_list(token, from_id, function(err, result) {
		if(err) {
			res.jsonp('there is error');
		} else {
			res.jsonp(result);
		}
	});
});

app.post('/change_my_password', function(req, res) {
	var message = req.body;
	var token = message.Token, old_password = message.old_password, new_password = message.new_password;
	
	nex.change_my_password(token, old_password, new_password, function(err, result) {
		if(err) {
			res.jsonp('there is error');
		} else {
			res.jsonp(result);
		}
	});
});

app.post('/change_my_basic_nickname', function(req, res) {
	var message = req.body;
	var token = message.Token, nickname = message.nickname;
	
	nex.change_my_basic_nickname(token, nickname, function(err, result) {
		if(err) {
			res.jsonp('there is error');
		} else {
			res.jsonp(result);
		}
	});
});

app.post('/change_my_basic_fullname', function(req, res) {
	var message = req.body;
	var token = message.Token, fullname = message.fullname;
	
	nex.change_my_basic_fullname(token, fullname, function(err, result) {
		if(err) {
			res.jsonp('there is error');
		} else {
			res.jsonp(result);
		}
	});
});


/*********************************************

**********************************************/

app.get('/notification_list', function(req, res) {
	var token = req.query.token;
	nex.notification_list(token, function(err, result) {
		if(err) {
			res.jsonp('there is error');
		} else {
			res.jsonp(result);
		}
	});
});

app.get('/notification_viewed', function(req, res) {
	var token = req.query.token, id = req.query.id;
	
	nex.notification_viewed(token, id, function(err, result) {
		if(err) {
			res.jsonp('there is error');
		} else {
			res.jsonp(result);
		}
	});
});


/*********************************************

**********************************************/

var _notify = function() {
	var map = {};
	
	function push(userid, socketid) {
		logger.info('_notify.map push('+userid+','+socketid+')', 3);
		if(userid in map) { // already exist
			map[userid].push(socketid);
		} else {
			map[userid] = [];
			map[userid].push(socketid);
		}
	}
	
	function remove(userid, socketid) {
		logger.info('_notify.map remove('+userid+','+socketid+')', 3);
		if((userid in map) && map[userid].length > 1) {
			var index = map[userid].indexOf(socketid);
			map[userid].splice(index, 1);
		} else{
			delete map[userid];
			pubsub.unsubscribe(userid);
		}
	}
	
	function emit(userid, message) {
		logger.info('_notify.map emit('+userid+','+message+') length ' + map[userid].length, 3);
		for(i in map[userid]) {
			io.to(map[userid][i]).emit('message', message);
		}
	}
	
	return  {
		emit : emit,
		push : push,
		remove : remove
	}
}();

io.on('connection', function(socket){
	var user_id;
	socket.on('init', function(msg) {
		user_id = jsonwebtoken.decode(msg)._id;
		_notify.push(user_id, socket.id);

		pubsub.subscribe(user_id, function(err, m){
				_notify.emit(user_id, m);
			});
	});

	socket.on('disconnect', function(){
		_notify.remove(user_id, socket.id);
	});
  
});


//////////////////////////////////////////////////////////////////////
 
server.listen(app.get('port'), function() {
  logger.log("Node app is running at localhost: " + app.get('port'));
  logger.log("Running at folder: " + __dirname);
});
