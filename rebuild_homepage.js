const Mongo = require('./db/db.js')
	, config = require('./lib/misc/config.js')
	, { buildHomepage } = require('./lib/build/tasks.js');

(async () => {
	try {
		await Mongo.connect();
		await Mongo.checkVersion();
		await config.load();
		await buildHomepage();
		console.log('Homepage rebuilt successfully');
		process.exit(0);
	} catch (err) {
		console.error('Failed to rebuild homepage:', err);
		process.exit(1);
	}
})();
