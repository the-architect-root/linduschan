'use strict';

const Mongo = require(__dirname+'/db/db.js')
	, config = require(__dirname+'/lib/misc/config.js')
	, buildQueue = require(__dirname+'/lib/build/queue.js');

(async () => {
	await Mongo.connect();
	await Mongo.checkVersion();
	await config.load();

	const { Boards } = require(__dirname+'/db/');

	const board = await Boards.findOne({ uri: 'b' });
	if (!board) {
		console.log('Board not found');
		process.exit(1);
	}

	console.log('Triggering rebuild for board:', board._id);
	buildQueue.push({
		'task': 'buildBoardMultiple',
		'options': {
			'board': board,
			'startpage': 1,
			'endpage': 10
		}
	});

	buildQueue.push({
		'task': 'buildCatalog',
		'options': {
			'board': board,
		}
	});

	console.log('Rebuild tasks added to queue');
	setTimeout(() => process.exit(0), 1000);
})();
