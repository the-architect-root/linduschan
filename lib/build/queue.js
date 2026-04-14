'use strict';

const Queue = require('bull');

// Load redis config from secrets.js or environment variables
let redis;
try {
	const secrets = require(__dirname+'/../../configs/secrets.js');
	redis = secrets.redis;
} catch (e) {
	redis = {
		host: process.env.REDIS_HOST,
		port: parseInt(process.env.REDIS_PORT) || 6379,
		password: process.env.REDIS_PASSWORD,
		db: 0
	};
}

const taskQueue = new Queue('task', { redis });

module.exports = {

	queue: taskQueue,

	push: (data, options) => {
		taskQueue.add(data, { ...options, removeOnComplete: true});
	}

};
