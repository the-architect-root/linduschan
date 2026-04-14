// Vercel serverless entry point
// This handler waits for the async server initialization to complete

let serverReady = false;
let serverApp = null;

// Require server.js - this starts async initialization
const serverModule = require('../server.js');

// Poll for server readiness (server.js sets module.exports = app when ready)
const waitForServer = () => {
	return new Promise((resolve) => {
		const check = () => {
			// server.js exports app either at top level (local) or inside async IIFE (Vercel)
			if (serverModule && typeof serverModule === 'function') {
				serverApp = serverModule;
				serverReady = true;
				resolve(serverApp);
			} else {
				setTimeout(check, 100);
			}
		};
		check();
	});
};

module.exports = async (req, res) => {
	if (!serverReady) {
		await waitForServer();
	}
	return serverApp(req, res);
};
