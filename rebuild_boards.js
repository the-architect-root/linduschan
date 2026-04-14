'use strict';

const Mongo = require(__dirname+'/db/db.js')
	, config = require(__dirname+'/lib/misc/config.js')
	, buildQueue = require(__dirname+'/lib/build/queue.js');

(async () => {
	await Mongo.connect();
	await Mongo.checkVersion();
	await config.load();

	console.log('Triggering rebuild of boards page');
	buildQueue.push({
		'task': 'buildBoards',
		'options': {}
	});

	console.log('Rebuild task added to queue');
	setTimeout(() => process.exit(0), 1000);
})();
