'use strict';

// Load config from secrets.js or environment variables
let dbURL, dbName;
try {
	const secrets = require(__dirname+'/../configs/secrets.js');
	dbURL = secrets.dbURL;
	dbName = secrets.dbName;
} catch (e) {
	// Fallback to environment variables
	dbURL = process.env.MONGODB_URL;
	dbName = process.env.DB_NAME || 'jschan';
}

const { MongoClient, ObjectId, Int32, Binary } = require('mongodb')
	, { migrateVersion } = require(__dirname+'/../package.json');

module.exports = {

	connect: async () => {
		module.exports.client = new MongoClient(dbURL, {
			serverSelectionTimeoutMS: 15000,
			connectTimeoutMS: 10000,
			socketTimeoutMS: 45000,
			tlsAllowInvalidCertificates: true,
		});
		await module.exports.client.connect();
		module.exports.db = module.exports.client.db(dbName);
	},

	//do i really want a separate fuckin file just for these? lol
	getConfig: () => {
		return module.exports.db.collection('globalsettings').findOne({ _id: 'globalsettings' });
	},

	setConfig: (newSettings) => {
		return module.exports.db.collection('globalsettings').replaceOne({ _id: 'globalsettings' }, newSettings, { upsert: true });
	},

	checkVersion: async() => {
		const currentVersion = await module.exports.db
			.collection('version')
			.findOne({ '_id': 'version' })
			.then(res => res.version);
		if (currentVersion < migrateVersion) {
			console.error('Your migration version is out-of-date. Run `gulp migrate` to update.');
			process.exit(1);
		}
	},

	setDefaultConfig: () => {
		const defaultConfig = {
			otherMimeTypes: [
				'application/epub+zip',
				'application/zip',
				'application/x-zip-compressed',
				'multipart/x-zip',
			],
			disableAnonymizerPosting: false,
			disableVpnPosting: false,
			vpnBlock: {
				enabled: false,
				apiKey: null,
			},
		};
		return module.exports.db.collection('globalsettings').replaceOne({ _id: 'globalsettings' }, defaultConfig, { upsert: true });
	},

	ObjectId,

	NumberInt: Int32,

	Binary,

};
