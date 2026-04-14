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
		const { language, cacheTemplates, boardDefaults, globalLimits, captchaOptions, archiveLinksURL,
			reverseImageLinksURL, meta, enableWebring, globalAnnouncement, enableWeb3, ethereumLinksURL } = config.get;
		//cache loaded templates
		app.cache = {};
		app[cacheTemplates === true ? 'enable' : 'disable']('view cache');
		//default settings
		app.locals.Permissions = Permissions;
		app.locals.defaultTheme = 'yotsuba-b';
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

	// routes
	app.use(express.static(__dirname+'/static', { redirect: false }));
	app.use(express.static(__dirname+'/static/html', { redirect: false }));
	app.use(express.static(__dirname+'/static/json', { redirect: false }));

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
