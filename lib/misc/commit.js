'use strict';

module.exports = (() => {
	try {
		const { execSync } = require('child_process');
		return execSync('git rev-parse --short HEAD 2>/dev/null || echo unknown', { encoding: 'utf8' }).trim();
	} catch (e) {
		// git not available (e.g. in Vercel/serverless)
		return 'unknown';
	}
})();
