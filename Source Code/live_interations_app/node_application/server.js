/*------------------Handle basic get requests---------------------*/
const express = require('express');
var fs = require('fs');
var https = require('https');
var request = require('request');
var privateKey  = fs.readFileSync('https/privateKey.key', 'utf8');
var certificate = fs.readFileSync('https/certificate.crt', 'utf8');

const app = express();
const httpsPort = 8443;
var credentials = {key: privateKey, cert: certificate};

var httpsServer = https.createServer(credentials, app);

//httpServer.listen(httpPort);
httpsServer.listen(httpsPort, () => {
	console.info('listening on port %d', httpsPort);
});


// Set public folder as root
//app.use(express.static('public'));

// Provide access to node_modules folder from the client-side
app.use('/scripts', express.static(`${__dirname}/node_modules/`));
app.use('/css',  express.static(`${__dirname}/public/css/`));
app.use('/js',  express.static(`${__dirname}/public/js/`));
//app.use('/client', express.static(`${__dirname}/public/client.html`));
//app.use(express.static(__dirname + '/public'));

//ejs testing
//set the view engine to ejs
app.set('view engine', 'ejs');

//use res.render to load up an ejs view file

function getParameterByName(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, '\\$&');
    var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

//index page
app.get('/', function(req, res) {
	var user = {"userid": getParameterByName('id',req.url), "firstName":getParameterByName('name',req.url)};

	//console.log("id: " + getParameterByName('id',req.url));
	res.render('pages/index', {
		user: user
	});
	
});

//client page
app.get('/client', function(req, res) {
	var user = {"userid": getParameterByName('id',req.url), "firstName":getParameterByName('name',req.url)};

	res.render('pages/client', {
		user: user
	});
});

//app.listen(8443);
/*----------------------------Handling web sockets-----------------------------*/
//require our websocket library 
var WebSocketServer = require('ws').Server; 

//creating a websocket server at port 9090 
var wss = new WebSocketServer({server: httpsServer}); 

//all connected to the server users 
var users = {};
var userCount = 0;


//when a user connects to our sever 
wss.on('connection', function(connection) {
  	
   //when server gets a message from a connected user 
	connection.on('message', function(message) { 
	
		var data; 
			
		//accepting only JSON messages 
		try { 
			data = JSON.parse(message); 
		} catch (e) { 
			console.log("Invalid JSON"); 
			data = {}; 
		}
		//switching type of the user message 
		switch (data.type) { 
			//when a user tries to login
			case "login": 
			
				//if anyone is logged in with this username then refuse
				if(users[data.name]){
					sendTo(connection,{ 
						type: "login", 
						success: false,
						name: data.name
					});
				} else{ 
					//save user connection on the server 
					users[data.name] = connection; 
					connection.name = data.name; 
					
					sendTo(connection, { 
						type: "login", 
						success: true,
						name: data.name
					});
					userCount++;
				}
				
				break;	
			case "videoOffer": 
				/* for ex. ifUserA wants to call UserB 
				if UserB exists then send him offer details */
				var conn = users[data.target]; 
					
				if(conn != null){
					//setting that UserA connected with UserB 
					connection.otherName = data.name;
					sendTo(conn, {
						type: "videoOffer",
						offer: data.offer,
						name: connection.name
					}); 
				}
				
            break;

			case "canvasOffer": 
				//for ex. UserA wants to call UserB 	
				//if UserB exists then send him offer details 
				var conn = users[data.target];
				if(conn != null) { 
				   //setting that UserA connected with UserB 
				   connection.otherName = data.name; 
				   sendTo(conn,{
					  type: "canvasOffer",
					  offer: data.offer, 
					  name: connection.name 
				   }); 
				}
				
            break;
						
			case "videoAnswer":  
				//for ex. UserB answers UserA 
				var conn = users[data.target]; 
					
				if(conn != null) { 
				   connection.otherName = data.name; 
				   sendTo(conn, { 
					  type: "videoAnswer", 
					  answer: data.answer,
						name: data.name
				   }); 
				} 
				
			break;
			
			case "canvasAnswer": 
				//for ex. UserB answers UserA 
				var conn = users[data.target]; 
					
				if(conn != null) { 
				   connection.otherName = data.name; 
				   sendTo(conn, { 
					  type: "canvasAnswer", 
					  answer: data.answer,
					  name: data.name
				   }); 
				}
			
            break; 
				
			case "videoCandidate": 
				var conn = users[data.target];
					
				if(conn != null) { 
				   sendTo(conn, { 
					  type: "videoCandidate", 
					  candidate: data.candidate,
						name: data.name
				   }); 
				} 
					
            break;
			
			case "canvasCandidate": 
				var conn = users[data.target];
					
				if(conn != null) { 
				   sendTo(conn, { 
					  type: "canvasCandidate", 
					  candidate: data.candidate,
					  name: data.name
				   }); 
				} 
					
            break;
			
			case "teacherLeft": 
				var conn;
				//teacher has left class, notify all students to end their sessions
				for(let user of Object.keys(users)){
					conn = users[user];
					if(data.name != user){ //if user is not the teacher, because they take out their own garbage
						users[user] = null; 
						if(conn != null) {
							sendTo(conn, { 
								type: "leave"
							}); 
						}
					}
				}
					
            break;
			
			case "studentLeft": 
				var conn = users[data.name]; 
				users[data.name] = null;					
				break;
			
			case "pleaseCallMe": 
				//for ex. UserA wants to call UserB 
				//if UserB exists then send him the callback
				var conn = users["Lesego"];
				console.log(conn); 
				console.log("Inside please call me");
					
				if(conn != null){
					connection.otherName = data.name; 
							
					sendTo(conn, { 
						type: "pleaseCallMe", 
						name: data.name 
					});				
				}
				else{

				}
			break;
			
			case "getName":   
				//var userName = "";

				process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
				request('https://137.215.42.239/moodle/local/testplugin/client/client.php', function(error, response, body) {
					console.log('error: ', error);
					console.log('statusCode: ', response && response.statusCode);
					//userName = body.toString(); it seems that I cannot copy the body for later use

					sendTo(connection,{ 
						type: "getName", 
						success: true,
						name: body
					});
				});
				
			break;
				
			default: 
				sendTo(connection, { 
				   type: "error", 
				   message: "Command not found: " + data.type 
				}); 
					
            break; 
		}
		
	}); 
	
	//when user exits, for example closes a browser window 
	//this may help if we are still in "offer","answer" or "candidate" state 
	connection.on("close", function() {
		if(connection.name) {
			delete users[connection.name];
			if(connection.otherName){ 
				var conn = users[connection.otherName]; 
				//conn.otherName = null;
				
				if(conn != null) { 
					sendTo(conn,{ 
						type: "leave"
					});
				}
			}
		}
		
	});  
	
	connection.send("wss connection live!");  
});
  
function sendTo(connection, message) {
	connection.send(JSON.stringify(message));
}

function allCallsEnded(){
	if(userCount <= 0)
		return true;
	else
		return false;
}