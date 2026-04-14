'use strict';

// Load debugLogs from secrets.js or environment variables
let debugLogs;
try {
	const secrets = require(__dirname+'/../../configs/secrets.js');
	debugLogs = secrets.debugLogs;
} catch (e) {
	debugLogs = process.env.DEBUG_LOGS === 'true';
}

const Files = require(__dirname+'/../../db/files.js')
	, { remove } = require('fs-extra')
	, uploadDirectory = require(__dirname+'/../../lib/file/uploaddirectory.js')
	, timeUtils = require(__dirname+'/../../lib/converter/timeutils.js');

module.exports = {

	func: async (fileNames) => {
		const query = {
			'count': {
				'$lte': 0
			}
		};
		if (fileNames) {
			query['_id'] = {
				'$in': fileNames
			};
		}
		const unreferenced = await Files.db.find(query, {
			'projection': {
				'count': 0,
				'size': 0
			}
		}).toArray();
		await Files.db.deleteMany(query);
		await Promise.all(unreferenced.map(async file => {
			debugLogs && console.log('Pruning', file._id);
			return Promise.all(
				[remove(`${uploadDirectory}/file/${file._id}`)]
					.concat(file.exts ? file.exts.filter(ext => ext).map(ext => {
						remove(`${uploadDirectory}/file/thumb/${file._id.split('.')[0]}${ext}`);
					}) : [])
			);
		}));
	},
	interval: timeUtils.DAY,
	immediate: true,
	condition: null,

};
