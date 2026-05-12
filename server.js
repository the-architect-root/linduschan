'use strict';

process
	.on('uncaughtException', console.error)
	.on('unhandledRejection', console.error);

const config = require(__dirname+'/lib/misc/config.js')
	, express = require('express')
	, path = require('path')
	, app = express()
	, server = require('http').createServer(app)
	, cookieParser = require('cookie-parser');

// Load config from secrets.js or environment variables
let port, cookieSecret, debugLogs, google, hcaptcha, yandex;
try {
	const secrets = require(__dirname+'/configs/secrets.js');
	port = secrets.port;
	cookieSecret = secrets.cookieSecret;
	debugLogs = secrets.debugLogs;
	google = secrets.google;
	hcaptcha = secrets.hcaptcha;
	yandex = secrets.yandex;
} catch (e) {
	// Fallback to environment variables
	port = parseInt(process.env.PORT) || 3000;
	cookieSecret = process.env.COOKIE_SECRET || 'default-secret';
	debugLogs = process.env.DEBUG_LOGS === 'true';
	google = process.env.GOOGLE_CAPTCHA_SITE_KEY ? { siteKey: process.env.GOOGLE_CAPTCHA_SITE_KEY, secretKey: process.env.GOOGLE_CAPTCHA_SECRET_KEY } : null;
	hcaptcha = process.env.HCAPTCHA_SITE_KEY ? { siteKey: process.env.HCAPTCHA_SITE_KEY, secretKey: process.env.HCAPTCHA_SECRET_KEY } : null;
	yandex = process.env.YANDEX_SITE_KEY ? { siteKey: process.env.YANDEX_SITE_KEY, secretKey: process.env.YANDEX_SECRET_KEY } : null;
}

const Mongo = require(__dirname+'/db/db.js')
	, dynamicResponse = require(__dirname+'/lib/misc/dynamic.js')
	, commit = require(__dirname+'/lib/misc/commit.js')
	, { version } = require(__dirname+'/package.json')
	, formatSize = require(__dirname+'/lib/converter/formatsize.js')
	, CachePugTemplates = require('cache-pug-templates')
	, { Permissions } = require(__dirname+'/lib/permission/permissions.js')
	, i18n = require(__dirname+'/lib/locale/locale.js');

(async () => {

	const env = process.env.NODE_ENV;
	const production = env === 'production';
	debugLogs && console.log('process.env.NODE_ENV =', env);
	process.env.NO_CAPTCHA && console.warn('WARNING, RUNNING WITH process.env.NO_CAPTCHA, CAPTCHA CHECKS ARE SKIPPED!');

	// connect to mongodb
	debugLogs && console.log('CONNECTING TO MONGODB');
	await Mongo.connect();
	await Mongo.checkVersion();
	await config.load();

	// connect to redis
	debugLogs && console.log('CONNECTING TO REDIS');
	const redis = require(__dirname+'/lib/redis/redis.js');

	// load roles early
	const roleManager = require(__dirname+'/lib/permission/rolemanager.js');
	await roleManager.load();

	// disable useless express header
	app.disable('x-powered-by');
	//query strings
	app.set('query parser', 'simple');
	// parse forms
	app.use(express.urlencoded({extended: false}));
	// parse cookies
	app.use(cookieParser(cookieSecret));

	// Security headers
	app.use((req, res, next) => {
		// Content Security Policy - allow framing for bypass pages
		const isBypassPage = req.path.startsWith('/bypass') || req.path.startsWith('/captcha.html');
		const frameAncestors = isBypassPage ? "'self'" : "'none'";
		res.setHeader('Content-Security-Policy', 
			"default-src 'self'; " +
			"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com; " +
			"style-src 'self' 'unsafe-inline'; " +
			"img-src 'self' data: blob: https:; " +
			"font-src 'self' data:; " +
			"connect-src 'self' ws: wss:; " +
			"frame-src 'self' https://www.youtube.com https://youtube.com; " +
			`frame-ancestors ${frameAncestors}; ` +
			"form-action 'self';"
		);
		// X-Frame-Options - allow framing for bypass pages
		const frameOptions = isBypassPage ? 'SAMEORIGIN' : 'DENY';
		res.setHeader('X-Frame-Options', frameOptions);
		// X-Content-Type-Options
		res.setHeader('X-Content-Type-Options', 'nosniff');
		// Referrer-Policy
		res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
		// Permissions-Policy
		res.setHeader('Permissions-Policy', 
			'geolocation=(), ' +
			'microphone=(), ' +
			'camera=(), ' +
			'payment=(), ' +
			'usb=(), ' +
			'magnetometer=(), ' +
			'gyroscope=(), ' +
			'accelerometer=()'
		);
		// Strict-Transport-Security (only in production and HTTPS)
		if (production && req.secure) {
			res.setHeader('Strict-Transport-Security', 'max-age=15552000'); // 6 months
		}
		next();
	});

	// session store
	const sessionMiddleware = require(__dirname+'/lib/middleware/permission/usesession.js');
	app.use(sessionMiddleware);

	// connect socketio
	const Socketio = require(__dirname+'/lib/misc/socketio.js');
	debugLogs && console.log('STARTING WEBSOCKET');
	Socketio.connect(server, sessionMiddleware);

	//trust proxy for nginx
	app.set('trust proxy', 1);

	// use pug view engine
	const views = path.join(__dirname, 'views/pages');
	app.set('view engine', 'pug');
	app.set('views', views);

	const loadAppLocals = () => {
		const cfg = config.get || {};
		const language = cfg.language || 'en';
		const cacheTemplates = cfg.cacheTemplates || false;
		const boardDefaults = cfg.boardDefaults || { theme: 'yotsuba', codeTheme: 'dark' };
		const globalLimits = cfg.globalLimits || { postFilesSize: { max: 20971520 } };
		const captchaOptions = cfg.captchaOptions || { type: 'google' };
		const archiveLinksURL = cfg.archiveLinksURL || '';
		const reverseImageLinksURL = cfg.reverseImageLinksURL || '';
		const meta = cfg.meta || {};
		const enableWebring = cfg.enableWebring || false;
		const globalAnnouncement = cfg.globalAnnouncement || '';
		const enableWeb3 = cfg.enableWeb3 || false;
		const ethereumLinksURL = cfg.ethereumLinksURL || '';
		//cache loaded templates
		app.cache = {};
		app[cacheTemplates === true ? 'enable' : 'disable']('view cache');
		//default settings
		app.locals.Permissions = Permissions;
		app.locals.defaultTheme = boardDefaults.theme;
		app.locals.defaultCodeTheme = boardDefaults.codeTheme;
		app.locals.globalLimits = globalLimits;
		app.locals.ethereumLinksURL = ethereumLinksURL;
		app.locals.archiveLinksURL = archiveLinksURL;
		app.locals.reverseImageLinksURL = reverseImageLinksURL;
		app.locals.enableWebring = enableWebring;
		app.locals.enableWeb3 = enableWeb3;
		app.locals.commit = commit;
		app.locals.version = version;
		app.locals.meta = meta;
		app.locals.postFilesSize = formatSize(globalLimits.postFilesSize.max);
		app.locals.googleRecaptchaSiteKey = google ? google.siteKey : '';
		app.locals.hcaptchaSiteKey = hcaptcha ? hcaptcha.siteKey : '';
		app.locals.yandexSiteKey = yandex ? yandex.siteKey : '';
		app.locals.globalAnnouncement = globalAnnouncement;
		app.locals.captchaOptions = captchaOptions;
		app.locals.globalLanguage = language;
		i18n.init(app.locals);
		app.locals.setLocale(app.locals, language);
	};
	loadAppLocals();
	redis.addCallback('config', loadAppLocals);

	// blocked board check for static files
	const blockedBoardStatic = require(__dirname+'/lib/middleware/blockedboardstatic.js');
	app.use(blockedBoardStatic);

	// R2 file proxy - serve files from R2 when configured (must come before express.static)
	// R2 redirect disabled - serve all files from local storage
	// app.get('/file/:filename', async (req, res, next) => {
	// 	try {
	// 		const secrets = require(__dirname+'/configs/secrets.js');
	// 		if (!secrets.r2 || !secrets.r2.publicUrl) {
	// 			return next(); // R2 not configured, serve from local static
	// 		}
	// 		// Redirect to R2 public URL
	// 		return res.redirect(301, `${secrets.r2.publicUrl}/file/${req.params.filename}`);
	// 	} catch (e) {
	// 		return next(); // R2 not configured, serve from local static
	// 	}
	// });

	// R2 redirect disabled - serve all thumbnails from local storage
	// app.get('/file/thumb/:filename', async (req, res, next) => {
	// 	try {
	// 		const secrets = require(__dirname+'/configs/secrets.js');
	// 		if (!secrets.r2 || !secrets.r2.publicUrl) {
	// 			return next(); // R2 not configured, serve from local static
	// 		}
	// 		// Redirect to R2 public URL
	// 		return res.redirect(301, `${secrets.r2.publicUrl}/file/thumb/${req.params.filename}`);
	// 	} catch (e) {
	// 		return next(); // R2 not configured, serve from local static
	// 	}
	// });

	// Serve full-size files from new upload folders with board-specific paths
	app.get('/:board/file/:filename', async (req, res, next) => {
		const filename = req.params.filename;
		const board = req.params.board;
		const path = require('path');
		const fs = require('fs');

		// Check if file exists in board-specific upload folders
		const boardImageLocation = path.join(__dirname, `/static/${board}/uploads/images/`, filename);
		const boardVideoLocation = path.join(__dirname, `/static/${board}/uploads/videos/`, filename);
		const boardFileLocation = path.join(__dirname, `/static/${board}/file/`, filename);
		
		// Check new upload folders (non-board-specific)
		const imageLocation = path.join(__dirname, '/static/uploads/images/', filename);
		const videoLocation = path.join(__dirname, '/static/uploads/videos/', filename);
		const oldLocation = path.join(__dirname, '/static/file/', filename);

		if (fs.existsSync(boardImageLocation)) {
			res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache
			res.setHeader('ETag', fs.statSync(boardImageLocation).mtime.getTime().toString());
			return res.sendFile(boardImageLocation);
		} else if (fs.existsSync(boardVideoLocation)) {
			res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache
			res.setHeader('ETag', fs.statSync(boardVideoLocation).mtime.getTime().toString());
			return res.sendFile(boardVideoLocation);
		} else if (fs.existsSync(boardFileLocation)) {
			res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache
			res.setHeader('ETag', fs.statSync(boardFileLocation).mtime.getTime().toString());
			return res.sendFile(boardFileLocation);
		} else if (fs.existsSync(imageLocation)) {
			res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache
			res.setHeader('ETag', fs.statSync(imageLocation).mtime.getTime().toString());
			return res.sendFile(imageLocation);
		} else if (fs.existsSync(videoLocation)) {
			res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache
			res.setHeader('ETag', fs.statSync(videoLocation).mtime.getTime().toString());
			return res.sendFile(videoLocation);
		} else if (fs.existsSync(oldLocation)) {
			res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache
			res.setHeader('ETag', fs.statSync(oldLocation).mtime.getTime().toString());
			return res.sendFile(oldLocation);
		} else {
			return next();
		}
	});
	
	// Keep old route for backward compatibility
	app.get('/file/:filename', async (req, res, next) => {
		const filename = req.params.filename;
		const path = require('path');
		const fs = require('fs');

		// Check if file exists in new upload folders
		const imageLocation = path.join(__dirname, '/static/uploads/images/', filename);
		const videoLocation = path.join(__dirname, '/static/uploads/videos/', filename);
		const oldLocation = path.join(__dirname, '/static/file/', filename);

		if (fs.existsSync(imageLocation)) {
			res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache
			res.setHeader('ETag', fs.statSync(imageLocation).mtime.getTime().toString());
			return res.sendFile(imageLocation);
		} else if (fs.existsSync(videoLocation)) {
			res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache
			res.setHeader('ETag', fs.statSync(videoLocation).mtime.getTime().toString());
			return res.sendFile(videoLocation);
		} else if (fs.existsSync(oldLocation)) {
			res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache
			res.setHeader('ETag', fs.statSync(oldLocation).mtime.getTime().toString());
			return res.sendFile(oldLocation);
		} else {
			return next();
		}
	});

	// Serve thumbnails from /file/thumb/ with board-specific paths
	app.get('/:board/file/thumb/:filename', (req, res, next) => {
		const filename = req.params.filename;
		const board = req.params.board;
		const path = require('path');
		const fs = require('fs');

		// Check board-specific thumb folder
		const boardThumbLocation = path.join(__dirname, `/static/${board}/file/thumb/`, filename);
		// Check new upload folders for thumbnails
		const thumbLocation = path.join(__dirname, '/static/uploads/images/thumb/', filename);
		const oldThumbLocation = path.join(__dirname, '/static/file/thumb/', filename);

		if (fs.existsSync(boardThumbLocation)) {
			res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache
			res.setHeader('ETag', fs.statSync(boardThumbLocation).mtime.getTime().toString());
			return res.sendFile(boardThumbLocation);
		} else if (fs.existsSync(thumbLocation)) {
			res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache
			res.setHeader('ETag', fs.statSync(thumbLocation).mtime.getTime().toString());
			return res.sendFile(thumbLocation);
		} else if (fs.existsSync(oldThumbLocation)) {
			res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache
			res.setHeader('ETag', fs.statSync(oldThumbLocation).mtime.getTime().toString());
			return res.sendFile(oldThumbLocation);
		} else {
			return next();
		}
	});
	
	// Keep old route for backward compatibility
	app.get('/file/thumb/:filename', (req, res, next) => {
		const filename = req.params.filename;
		const path = require('path');
		const fs = require('fs');

		// Check new upload folders for thumbnails
		const thumbLocation = path.join(__dirname, '/static/uploads/images/thumb/', filename);
		const oldThumbLocation = path.join(__dirname, '/static/file/thumb/', filename);

		if (fs.existsSync(thumbLocation)) {
			res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache
			res.setHeader('ETag', fs.statSync(thumbLocation).mtime.getTime().toString());
			return res.sendFile(thumbLocation);
		} else if (fs.existsSync(oldThumbLocation)) {
			res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache
			res.setHeader('ETag', fs.statSync(oldThumbLocation).mtime.getTime().toString());
			return res.sendFile(oldThumbLocation);
		} else {
			return next();
		}
	});

	// routes
	app.use(express.static(__dirname+'/static', { 
		redirect: false,
		maxAge: '7d', // Cache for 7 days
		etag: true,
		lastModified: true
	}));
	app.use(express.static(__dirname+'/static/html', { 
		redirect: false,
		maxAge: '1h', // Cache HTML for 1 hour
		etag: true,
		lastModified: true
	}));
	app.use(express.static(__dirname+'/static/json', { 
		redirect: false,
		maxAge: '1h', // Cache JSON for 1 hour
		etag: true,
		lastModified: true
	}));

	//localisation
	const { setGlobalLanguage } = require(__dirname+'/lib/middleware/locale/locale.js');
	app.use(i18n.init);
	app.use(setGlobalLanguage);

	//referer check middleware
	const referrerCheck = require(__dirname+'/lib/middleware/misc/referrercheck.js');
	app.use(referrerCheck);

	app.use('/forms', require(__dirname+'/controllers/forms.js'));
	app.use('/', require(__dirname+'/controllers/pages.js'));

	//404 catchall
	app.get('*', (req, res) => {
		res.status(404).render('404');
	});

	// catch any unhandled errors
	app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
		const { __ } = res.locals;
		let errStatus = 500;
		let errMessage = 'Internal Server Error';
		if (err.code === 'EBADCSRFTOKEN') {
			errMessage = 'Invalid CSRF token';
			errStatus= 403;
		}
		if (err.type != null) {
			//body-parser errors
			errStatus = err.status;
			switch (err.type) {
				case 'charset.unsupported':
				case 'entity.parse.failed':
				case 'entity.verify.failed':
				case 'encoding.unsupported':
				case 'request.size.invalid':
				case 'parameters.too.many':
					//no need to give an error for every one, since these will never happen to a legit user anyway
					errMessage = 'Invalid request body';
					break;
				case 'request.aborted':
					errMessage = 'Client aborted request';
					break;
				case 'entity.too.large':
					errMessage = 'Your upload was too large';
					break;
				default:
					break;
			}
		}
		if (errStatus === 500 && errMessage ===  'Internal Server Error') {
			//no specific/friendly error, probably something worth logging
			console.error(err);
		}
		return dynamicResponse(req, res, errStatus, 'message', {
			'title': __(errStatus === 500 ? 'Internal Server Error' : 'Bad Request'),
			'error': __(errMessage),
			'redirect': req.headers.referer || '/'
		});
	});

	//listen only if not in Vercel (Vercel uses serverless)
	if (!process.env.VERCEL && !process.env.NOW_REGION) {
		// Use 0.0.0.0 for Render, otherwise use JSCHAN_IP or default to 127.0.0.1
		const host = process.env.RENDER ? '0.0.0.0' : (process.env.JSCHAN_IP || '127.0.0.1');
		server.listen(port, host, () => {
			new CachePugTemplates({ app, views }).start();
			debugLogs && console.log(`LISTENING ON ${host}:${port}`);
			//let PM2 know that this is ready for graceful reloads and to serialise startup
			if (typeof process.send === 'function') {
				//make sure we are a child process of PM2 i.e. not in dev
				debugLogs && console.log('SENT READY SIGNAL TO PM2');
				process.send('ready');
			}
		});
	}

	const gracefulStop = () => {
		debugLogs && console.log('SIGINT SIGNAL RECEIVED');
		// Stops the server from accepting new connections and finishes existing connections.
		Socketio.io.close((err) => {
			// if error, log and exit with error (1 code)
			debugLogs && console.log('CLOSING SERVER');
			if (err) {
				console.error(err);
				process.exit(1);
			}
			// close database connection
			debugLogs && console.log('DISCONNECTING MONGODB');
			Mongo.client.close();
			//close redis connection
			debugLogs && console.log('DISCONNECTING REDIS');
			redis.close();
			// now close without error
			process.exit(0);
		});
	};

	//graceful stop
	process.on('SIGINT', gracefulStop);
	process.on('message', (message) => {
		if (message === 'shutdown') {
			gracefulStop();
		}
	});

	// Export for Vercel (only after full initialization)
	if (process.env.VERCEL || process.env.NOW_REGION) {
		module.exports = app;
	}

})();

// Export for local/PM2 (app will be ready when this is required after async init)
if (!process.env.VERCEL && !process.env.NOW_REGION) {
	module.exports = app;
}
