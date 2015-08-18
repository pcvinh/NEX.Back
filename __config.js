/* __config constant */

var is_prod = true;

/* database */ 
var db_username = is_prod ? 'postgres' : 'postgres';
var db_password = is_prod ? 'fKkg8GPb' : 'password';
var db_host = is_prod ? '10.240.199.51' : 'localhost';
//var db_host = is_prod ? '107.167.183.96' : 'localhost'; // this is to test at local nodejs connect to cloud database
var db_name = 'NEX';


var google_api_key = 'AIzaSyAArUeU1n8FB8ZqxRLyRCL-DivL0aY4ses';
var jwt_secret = 'hihihi'; // Need to be VERY SECRET. 

const pn_publish_key = 'pub-c-7b8f064f-cc65-4656-8d63-d6760bb6e0fe';
const pn_subscribe_key = 'sub-c-abe025b6-b042-11e4-85c1-02ee2ddab7fe';

var max_channels_per_favourite_radar = 5;

/*var module = {
	'LOGIN' : 0,
	'RADAR' : 1,
	'POST' : 2,
	'NOTIFY' : 3,
	'ME' : 4
};*/
var debug = [
	true, // 0 : LOGIN
	true, // 1 : RADAR
	true, // 2 : POST
	true, // 3 : NOTIFY
	true,  // 4 : ME
	true  // 5 : PROFILE
];

var log_path = 'logs/';

module.exports = {
	DB_USERNAME : db_username,
	DB_PASSWORD : db_password,
	DB_HOST : db_host,
	DB_NAME : db_name,
	GOOGLE_API_KEY : google_api_key,
	JWT_SECRET : jwt_secret,
	PN_PUBLISH_KEY : pn_publish_key,
	PN_SUBSCRIBE_KEY : pn_subscribe_key,
	MAX_CHANNELS_PER_FAVOURITE_RADAR : max_channels_per_favourite_radar,
	/*module : module,*/
	debug : debug,
	log_path : log_path
}