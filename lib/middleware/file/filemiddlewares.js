'use strict';

// Load debugLogs from secrets.js or environment variables
let debugLogs;
try {
	const secrets = require(__dirname+'/../../../configs/secrets.js');
	debugLogs = secrets.debugLogs;
} catch (e) {
	debugLogs = process.env.DEBUG_LOGS === 'true';
}

const dynamicResponse = require(__dirname+'/../../misc/dynamic.js')
	, { addCallback } = require(__dirname+'/../../redis/redis.js')
	, upload = require('@fatchan/express-fileupload')
	, fileHandlers = {}
	, fileSizeLimitFunction = (req, res) => {
		const { __ } = res.locals;
		return dynamicResponse(req, res, 413, 'message', {
			'title': __('Payload Too Large'),
			'message': __('Your upload was too large'),
			'redirect': req.headers.referer
		});
	}
	, missingExtensionLimitFunction = (req, res) => {
		const { __ } = res.locals;
		return dynamicResponse(req, res, 400, 'message', {
			'title': __('Bad Request'),
			'message': __('Missing file extensions'),
			'redirect': req.headers.referer
		});
	}
	, updateHandlers = () => {
		const cfg = require(__dirname+'/../../misc/config.js').get || {};
		const globalLimits = cfg.globalLimits || {
			flagFilesSize: { max: 10485760 }, flagFiles: { max: 5 },
			bannerFilesSize: { max: 10485760 }, bannerFiles: { max: 5 },
			assetFilesSize: { max: 10485760 }, assetFiles: { max: 5 },
			postFilesSize: { max: 20971520 }, postFiles: { max: 5 }
		};
		const filterFileNames = cfg.filterFileNames !== false;
		const spaceFileNameReplacement = cfg.spaceFileNameReplacement || '_';
		const uriDecodeFileNames = cfg.uriDecodeFileNames || false;
		['flag', 'banner', 'asset', 'post'].forEach(fileType => {
			const fileSizeLimit = globalLimits[`${fileType}FilesSize`] || { max: 10485760 };
			const fileNumLimit = globalLimits[`${fileType}Files`] || { max: 5 };
			const fileNumLimitFunction = (req, res) => {
				const { __ } = res.locals;
				const isPostform = req.path.endsWith('/post') || req.path.endsWith('/modpost');
				const message = (isPostform && res.locals.board)
					? __(`Max files per post ${res.locals.board.settings.maxFiles < globalLimits.postFiles.max ? 'on this board ' : ''}is %s`, res.locals.board.settings.maxFiles)
					: __('Max files per request is %s', fileNumLimit.max);
				return dynamicResponse(req, res, 400, 'message', {
					'title': __('Too many files'),
					'message': message,
					'redirect': req.headers.referer
				});
			};
			fileHandlers[fileType] = upload({
				defParamCharset: 'utf8',
				debug: debugLogs,
				createParentPath: true,
				safeFileNames: filterFileNames,
				spaceFileNameReplacement,
				preserveExtension: 4,
				uriDecodeFileNames,
				parseNested: true,
				limits: {
					totalSize: fileSizeLimit.max,
					fileSize: fileSizeLimit.max,
					files: fileNumLimit.max,
				},
				limitHandler: fileSizeLimitFunction,
				numFilesLimitHandler: fileNumLimitFunction,
				extensionLimitHandler: missingExtensionLimitFunction,
				useTempFiles: true,
				tempFileDir: __dirname+'/../../../tmp/'
			});
		});
	};

updateHandlers();
addCallback('config', updateHandlers);

module.exports = {

	asset: (req, res, next) => {
		return fileHandlers.asset(req, res, next);
	},
	banner: (req, res, next) => {
		return fileHandlers.banner(req, res, next);
	},
	flag: (req, res, next) => {
		return fileHandlers.flag(req, res, next);
	},
	posts: (req, res, next) => {
		return fileHandlers.post(req, res, next);
	},

};
