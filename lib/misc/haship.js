'use strict';

// Load ipHashSecret from secrets.js or environment variables
let ipHashSecret;
try {
	const secrets = require(__dirname+'/../../configs/secrets.js');
	ipHashSecret = secrets.ipHashSecret;
} catch (e) {
	ipHashSecret = process.env.IP_HASH_SECRET || 'default-ip-hash-secret';
}

const { createHash } = require('crypto');

module.exports = (ip) => createHash('sha256').update(ipHashSecret + ip).digest('base64');
