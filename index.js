var express = require ("express");
var app = express();
var router = express.Router()
var port = 6222; //9666;
var WatchJS = require("watchjs")
var watch = WatchJS.watch;
var unwatch = WatchJS.unwatch;
var callWatchers = WatchJS.callWatchers;
var question = "";
var questionAnswer = "";
var questionName = "";
var scoreweight = "";
var questiontype = "";
var MongoClient = require('mongodb').MongoClient;
var url = 'mongodb://localhost:27017/quizmaster';

// set rendering engine and static files
app.set('views', __dirname + '/tpl');
app.set('view engine', "jade");
app.engine('jade', require('jade').__express);
app.use(express.static(__dirname+"/public"))

//////////////////////////////////////////////////////////
//app.get("/", function(req, res){res.render("playerng")});
app.get("/board", function(req, res) {res.render("board")});
app.get("/host", function(req, res){res.render("hostng");});
//app.get("/test", function(req, res){res.render("test");});
app.get("/admin", function(req, res){res.render("admin");});
//app.get("/admin_question", function (req, res) { res.render("admin_question"); });



var log = function(x){ console.log(x)};


// gameState phases:
// register: register players and hosts
// lock: buzzer locked
// release: buzzer released
// end: game ended
const REGISTER = "REGISTER"
const LOCK     = "LOCK"
const RAPID    = "RAPID"
const END      = "END"

//QUESTION TYPES
const TEXT = "TEXT"
const MC = "MC"

var gameState = null;

var resetGame = function () {

	gameState = {
		game_title:"Quizmaster",
		host: null,
		questionsPlayed: [],
		players:[],
		currentQuestion:"Question not found.",
        scoreweight: null,
        cQAnswer:null,
		scores: {},
		clientPlayerDict:{},
        phase: REGISTER,
        questiontype: null,
		round:1,
		clientAnswers:{},
        phase_options: [REGISTER, LOCK, RAPID, END],
        questiontype_options: [TEXT, MC],
        phaseOpt: {}, // will be filled below
        questionOpt: {},
		score_buttons: [-20,-10,-1,5,10,20],
		rounds:[1,2,3],
		score_recoreds: [],
		buzzerOrder:[],
		answerBoards:{},
		hot_seats: [],
		hot_player:null,
	}
	//initialize phase_opt
	for (var i=0; i < gameState.phase_options.length; i++){
		var po = gameState.phase_options[i]
		gameState.phaseOpt[po] = po
    }

    for (var j = 0; j < gameState.questiontype_options.length; j++) {
        var qto = gameState.questiontype_options[j]
        gameState.questionOpt[qto] = qto
    }
};

app.get('/', function (req, res) {
	var MongoClient = require('mongodb').MongoClient
	var url = 'mongodb://localhost/quizmaster';

	var results_from_mongo = [];

	MongoClient.connect(url, function (err, db) {
	  var str = db.collection('qmquestions').find({}).toArray(function (err,docs){
		if(err){
		  return res.send('error')
		}
		console.log("Called from /" + docs)
		return res.render('playerng', {results_from_mongo : docs});
	  })
	});
  });

/* GET home page. and iterate, display the collection to console log. */
app.get('/admin_question', function (req, res) {
	var MongoClient = require('mongodb').MongoClient
	var url = 'mongodb://localhost/quizmaster';

	var results_from_mongo = [];

	MongoClient.connect(url, function (err, db) {
	  var str = db.collection('qmquestions').find({}).toArray(function (err,docs){
		if(err){
		  return res.send('error')
		}
		console.log("Called from admin_question" + docs)
		return res.render('admin_question', {results_from_mongo : docs});
	  })
	});
  });

var dbConnect = function (questionName, question, answer, scoreweight, questiontype){
	'use strict'

	var assert = require('assert');
	var ObjectId = require('mongodb').ObjectID;
	var MongoClient = require('mongodb').MongoClient;

	var insertDocument = function(db, callback) {
	db.collection('qmquestions').insertOne( {
	   "question" : {
		  "questionTitle" : questionName,
		  "question" : question,
		  "answer": answer,
          "scoreweight": scoreweight,
          "questiontype": questiontype
	   },
	}, function(err, result) {
	 assert.equal(err, null);
	 console.log("Inserted a document into the question collection.");
	 callback();
   });
 };

	MongoClient.connect(url, function(err, db) {
  assert.equal(null, err);
  insertDocument(db, function() {
	  db.close();
  });
});

};

var generateQuestion = function(){
	var MongoClient = require('mongodb').MongoClient
	var url = 'mongodb://localhost/quizmaster';



	var results_from_mongo = [];

	MongoClient.connect(url, function(err, db){
		var str = db.collection('qmquestions').find({}).toArray(function (err, doc) {
			var test = doc[Math.floor(Math.random() * doc.length)];
			var found = false;
			if (gameState.questionsPlayed.indexOf(test.question.question) >= 0) //&& gameState.questionsPlayed.length == doc.length)
            {
                if (gameState.questionsPlayed.length == doc.length)
                {
                    console.log("Out of questions.");
                    gameState.currentQuestion = "Question not found.";
                    gameState.scoreweight = 0;
                    gameState.phase = "LOCK"
                }
                else
                {
                    generateQuestion();
                }
            }
            else
            {
                if (test.question.questiontype == gameState.questionOpt.MC) {
                    gameState.questionsPlayed.push(test.question.question);
                    gameState.questiontype = gameState.questionOpt.MC;
                    gameState.scoreweight = test.question.scoreweight;
                    gameState.cQAnswer = test.question.answer;
                    gameState.currentQuestion = test.question.question;
                    console.log(gameState.questionsPlayed);
                    console.log("[CURRENT QUESTION] " + gameState.currentQuestion);
                    console.log("[POINT WEIGHT] " + gameState.scoreweight);
                    console.log("[QUESTION TYPE] " + gameState.questiontype);
                }
                else {
                    gameState.questionsPlayed.push(test.question.question);
                    gameState.questiontype = "TEXT";
                    gameState.scoreweight = test.question.scoreweight;
                    gameState.currentQuestion = test.question.question;
                    gameState.cQAnswer = test.question.answer;
                    console.log(gameState.questionsPlayed);
                    console.log("[CURRENT QUESTION] " + gameState.currentQuestion);
                    console.log("[POINT WEIGHT] " + gameState.scoreweight);
                    console.log("[QUESTION TYPE] " + gameState.questiontype);
                }
            }
			return gameState.currentQuestion
		});
	});
};

resetGame();

var io = require('socket.io').listen(app.listen(port));

var updateGame = function(){
	io.sockets.emit('gameState',  gameState);
}
// watch for some change in the game state
watch(gameState, function(){
	log("some attribute changed!")
	updateGame();

});
// watch for some change in player state
watch(gameState, "players", function(){
	log("players attribute changed!!")
	updateGame();

})

var ioResponseRegistry = {}

var ioResponse = function(x){
	for(var key in Object.keys(ioResponseRegistry)){
		ioResponseRegistry[key](x);
	}
}
//////////////////////////////////////////////////////////
// Game logic:

var addPlayer = function(player){
	gameState.players.push(player);
}
var clearPlayer = function(){
	gameState.players = []
}
var removePlayer = function(player){

}


var userNames = function(){
	var k = gameState.players.map(function(p){return p.username});
	console.log(JSON.stringify(k))
	return k
}


var refreshPlayerReg = function(){
	log("refreshing")
	var players = []

	for(var key in gameState.clientPlayerDict){
		log("ref:"+key)
		var p = gameState.clientPlayerDict[key];
		if (players.filter(function(x){
			if (x){
			return x.username == p.username
		}else {return false}
		}).length == 0 ) {
			players.push(p)
		}

		if (p.username in gameState.scores){
			// do nothing ... for now
		}else{
			gameState.scores[p.username] = 0;
		}
	}
	gameState.players = players;


}

io.sockets.on('connection', function (socket) {
	console.log("connected to id"+socket.id)
	console.log("ip is" +socket.handshake.address.address)

	var player = null;

	socket.emit('message', {message: 'Connection to QuizMaster Server established.'});

	io.sockets.emit('gameState', gameState);

	socket.on('registerName', function(data){
		console.log ("registerName "+ JSON.stringify(data));
		if (data.username){
			gameState.clientPlayerDict[socket.id] = data;
			refreshPlayerReg();
		}
		updateGame();
	})

	socket.on('testThingy', function(data){
		console.log("[TEST] " + JSON.stringify(data));
		dbConnect(data.questionTitle, data.question, data.answer, data.scoreweight, data.questiontype);
	})

	socket.on('gQuestion', function(){
		console.log("[GENERATEQUESTION]");
		generateQuestion();
		updateGame();
		console.log("AFTER UPDATE]" + gameState.currentQuestion)
	})

	socket.on('addPoints', function(data){
		log("addPoints"+ JSON.stringify(data))
		if(data.player.username===null){
			log("addPoints: data")

		}else{
			var playerName = data.player.username
			var test = parseInt(data.points)
			var newscore = gameState.scores[playerName] + test

			log("pl:"+playerName+" "+data.points)
			log("[TEST VALUE PLEASE SHOW UP] " + test)
			gameState.scores[playerName] = newscore;
			updateGame();
		}
	});

	socket.on('change_phase', function(data){
		gameState.phase = data.phase;
		updateGame();
	});

	socket.on('change_round', function(data){
		gameState.round = data.round;
		updateGame();
	});

	socket.on('change_hotseat', function(data){
		gameState.hot_player = data.hot_player;
		updateGame();
	});


	socket.on('resetAnswers', function(data){
		gameState.hot_player = null;
		gameState.answerBoards= {}
		gameState.hot_seats = []
		// gameState.updateGame();
		updateGame();
	});

	socket.on('resetGame', function(){resetGame();updateGame();})

	socket.on('dbConnect', function(){dbConnect();})

	socket.on('buzzer', function(data){
		gameState.hot_seats.push(data);
		gameState.answerBoards[data.username] = data.answer
		gameState.hot_player = gameState.hot_seats[0].username // first player
		updateGame();
	})



})



// setInterval(function(){console.log("tick"), 1000});




console.log("Listening on port " + port);
