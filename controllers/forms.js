'use strict';

const express  = require('express')
	, router = express.Router({ caseSensitive: true })
	, Boards = require(__dirname+'/../db/boards.js')
//middlewares
	, geoIp = require(__dirname+'/../lib/middleware/ip/geoip.js')
	, processIp = require(__dirname+'/../lib/middleware/ip/processip.js')
	, calcPerms = require(__dirname+'/../lib/middleware/permission/calcpermsmiddleware.js')
	, { Permissions } = require(__dirname+'/../lib/permission/permissions.js')
	, hasPerms = require(__dirname+'/../lib/middleware/permission/haspermsmiddleware.js')
	, numFiles = require(__dirname+'/../lib/middleware/file/numfiles.js')
	, imageHashes = require(__dirname+'/../lib/middleware/file/imagehash.js')
	, hashBanCheck = require(__dirname+'/../lib/middleware/file/hashbancheck.js')
	, banCheck = require(__dirname+'/../lib/middleware/permission/bancheck.js')
	, isLoggedIn = require(__dirname+'/../lib/middleware/permission/isloggedin.js')
	, verifyCaptcha = require(__dirname+'/../lib/middleware/captcha/verify.js')
	, csrf = require(__dirname+'/../lib/middleware/misc/csrfmiddleware.js')
	, referrerCheck = require(__dirname+'/../lib/middleware/misc/referrercheck.js')
	, useSession = require(__dirname+'/../lib/middleware/permission/usesession.js')
	, sessionRefresh = require(__dirname+'/../lib/middleware/permission/sessionrefresh.js')
	, dnsblCheck = require(__dirname+'/../lib/middleware/ip/dnsbl.js')
	, vpnBlock = require(__dirname+'/../lib/middleware/ip/vpnblock.js')
	, anonymizerBlock = require(__dirname+'/../lib/middleware/ip/anonymizerblock.js')
	, blockBypass = require(__dirname+'/../lib/middleware/captcha/blockbypass.js')
	, fileMiddlewares = require(__dirname+'/../lib/middleware/file/filemiddlewares.js')
	, { setBoardLanguage, setQueryLanguage } = require(__dirname+'/../lib/middleware/locale/locale.js')
//controllers
	, { deleteBoardController, editBansController, appealController, globalActionController, twofactorController,
		actionController, addCustomPageController, deleteCustomPageController, addNewsController,
		editNewsController, deleteNewsController, uploadBannersController, deleteBannersController, addFlagsController,
		deleteFlagsController, boardSettingsController, transferController, addAssetsController, deleteAssetsController,
		resignController, deleteAccountController, loginController, registerController, changePasswordController,
		deleteAccountsController, editAccountController, addFilterController, editFilterController, deleteFilterController, 
		globalSettingsController, featureThreadController, unfeatureThreadController, makePostController, 
		addStaffController, deleteStaffController, editStaffController, editCustomPageController, editPostController, 
		editRoleController, newCaptchaForm, blockBypassForm, logoutForm, deleteSessionsController, globalClearController, 
		blockBoardController, blogController } = require(__dirname+'/forms/index.js');

//make new post
router.post('/board/:board/post', geoIp, processIp, useSession, sessionRefresh, Boards.exists, setBoardLanguage, calcPerms, banCheck, referrerCheck, fileMiddlewares.posts,
	makePostController.paramConverter, verifyCaptcha, numFiles, hashBanCheck, blockBypass.middleware, vpnBlock, anonymizerBlock, dnsblCheck, imageHashes, makePostController.controller);
router.post('/board/:board/modpost', geoIp, processIp, useSession, sessionRefresh, Boards.exists, setBoardLanguage, calcPerms, banCheck, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_BOARD_GENERAL), fileMiddlewares.posts, makePostController.paramConverter, csrf, numFiles, hashBanCheck, blockBypass.middleware, anonymizerBlock, dnsblCheck, imageHashes, makePostController.controller); //mod post has token instead of captcha

//post actions
router.post('/board/:board/actions', geoIp, processIp, useSession, sessionRefresh, Boards.exists, setBoardLanguage, calcPerms, banCheck, actionController.paramConverter, verifyCaptcha, actionController.controller); //public, with captcha
router.post('/board/:board/modactions', geoIp, processIp, useSession, sessionRefresh, csrf, Boards.exists, setBoardLanguage, calcPerms, banCheck, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_BOARD_GENERAL), actionController.paramConverter, actionController.controller); //board manage page

router.post('/global/actions', geoIp, processIp, useSession, sessionRefresh, csrf, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_GLOBAL_GENERAL), globalActionController.paramConverter, globalActionController.controller); //global manage page

//appeal ban
router.post('/appeal', geoIp, processIp, useSession, sessionRefresh, appealController.paramConverter, verifyCaptcha, appealController.controller);

//featured threads (admin only)
router.post('/featurethread', useSession, sessionRefresh, csrf, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_GLOBAL_SETTINGS), featureThreadController);
router.post('/unfeaturethread', useSession, sessionRefresh, csrf, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_GLOBAL_SETTINGS), unfeatureThreadController);

//edit post
router.post('/editpost', geoIp, processIp, useSession, sessionRefresh, csrf, editPostController.paramConverter, Boards.bodyExists, setBoardLanguage, calcPerms,
	hasPerms.any(Permissions.MANAGE_GLOBAL_GENERAL, Permissions.MANAGE_BOARD_GENERAL), editPostController.controller);

//board management forms
router.post('/board/:board/transfer', useSession, sessionRefresh, csrf, Boards.exists, setBoardLanguage, calcPerms, isLoggedIn,
	hasPerms.any(Permissions.MANAGE_BOARD_OWNER, Permissions.MANAGE_GLOBAL_BOARDS), transferController.paramConverter, transferController.controller);
router.post('/board/:board/settings', geoIp, processIp, useSession, sessionRefresh, csrf, Boards.exists, setBoardLanguage, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_BOARD_SETTINGS), boardSettingsController.paramConverter, boardSettingsController.controller);
router.post('/board/:board/editbans', geoIp, processIp, useSession, sessionRefresh, csrf, Boards.exists, setBoardLanguage, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_BOARD_BANS), editBansController.paramConverter, editBansController.controller); //edit bans
router.post('/board/:board/addfilter', useSession, sessionRefresh, csrf, Boards.exists, setBoardLanguage, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_BOARD_SETTINGS), addFilterController.paramConverter, addFilterController.controller); //add new filter
router.post('/board/:board/editfilter', useSession, sessionRefresh, csrf, Boards.exists, setBoardLanguage, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_BOARD_SETTINGS), editFilterController.paramConverter, editFilterController.controller); //edit filter
router.post('/board/:board/deletefilter', useSession, sessionRefresh, csrf, Boards.exists, setBoardLanguage, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_BOARD_SETTINGS), deleteFilterController.paramConverter, deleteFilterController.controller); //delete filter
router.post('/board/:board/deleteboard', useSession, sessionRefresh, csrf, Boards.exists, setBoardLanguage, calcPerms, isLoggedIn,
	hasPerms.any(Permissions.MANAGE_BOARD_OWNER, Permissions.MANAGE_GLOBAL_BOARDS), deleteBoardController.paramConverter, deleteBoardController.controller); //delete board

//board crud banners, flags, assets, custompages
router.post('/board/:board/addbanners', geoIp, useSession, sessionRefresh, Boards.exists, setBoardLanguage, fileMiddlewares.banner, csrf, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_BOARD_CUSTOMISATION), numFiles, uploadBannersController.controller); //add banners
router.post('/board/:board/deletebanners', useSession, sessionRefresh, csrf, Boards.exists, setBoardLanguage, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_BOARD_CUSTOMISATION), deleteBannersController.paramConverter, deleteBannersController.controller); //delete banners
router.post('/board/:board/addassets', geoIp, useSession, sessionRefresh, Boards.exists, setBoardLanguage, fileMiddlewares.asset, csrf, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_BOARD_CUSTOMISATION), numFiles, addAssetsController.controller); //add assets
router.post('/board/:board/deleteassets', useSession, sessionRefresh, csrf, Boards.exists, setBoardLanguage, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_BOARD_CUSTOMISATION), deleteAssetsController.paramConverter, deleteAssetsController.controller); //delete assets
router.post('/board/:board/addflags', geoIp, useSession, sessionRefresh, Boards.exists, setBoardLanguage, fileMiddlewares.flag, csrf, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_BOARD_CUSTOMISATION), numFiles, addFlagsController.controller); //add flags
router.post('/board/:board/deleteflags', useSession, sessionRefresh, csrf, Boards.exists, setBoardLanguage, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_BOARD_CUSTOMISATION), deleteFlagsController.paramConverter, deleteFlagsController.controller); //delete flags
router.post('/board/:board/addcustompages', useSession, sessionRefresh, csrf, Boards.exists, setBoardLanguage, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_BOARD_CUSTOMISATION), addCustomPageController.paramConverter, addCustomPageController.controller); //add custom pages
router.post('/board/:board/deletecustompages', useSession, sessionRefresh, csrf, Boards.exists, setBoardLanguage, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_BOARD_CUSTOMISATION), deleteCustomPageController.paramConverter, deleteCustomPageController.controller); //delete custom pages
router.post('/board/:board/editcustompage', useSession, sessionRefresh, csrf, Boards.exists, setBoardLanguage, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_BOARD_CUSTOMISATION), editCustomPageController.paramConverter, editCustomPageController.controller); //edit custom page
router.post('/board/:board/addstaff', useSession, sessionRefresh, csrf, Boards.exists, setBoardLanguage, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_BOARD_STAFF), addStaffController.paramConverter, addStaffController.controller); //add board staff
router.post('/board/:board/editstaff', useSession, sessionRefresh, csrf, Boards.exists, setBoardLanguage, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_BOARD_STAFF), editStaffController.paramConverter, editStaffController.controller); //edit staff permission
router.post('/board/:board/deletestaff', useSession, sessionRefresh, csrf, Boards.exists, setBoardLanguage, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_BOARD_STAFF), deleteStaffController.paramConverter, deleteStaffController.controller); //delete board staff

//global management forms
router.post('/global/editbans', geoIp, processIp, useSession, sessionRefresh, csrf, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_GLOBAL_BANS), editBansController.paramConverter, editBansController.controller); //remove bans
router.post('/global/deleteboard', useSession, sessionRefresh, csrf, deleteBoardController.paramConverter, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_GLOBAL_BOARDS), deleteBoardController.controller); //delete board from global management panel
router.post('/global/addnews', useSession, sessionRefresh, csrf, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_GLOBAL_NEWS), addNewsController.paramConverter, addNewsController.controller); //add new newspost
router.post('/global/editnews', useSession, sessionRefresh, csrf, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_GLOBAL_NEWS), editNewsController.paramConverter, editNewsController.controller); //add new newspost
router.post('/global/deletenews', useSession, sessionRefresh, csrf, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_GLOBAL_NEWS), deleteNewsController.paramConverter, deleteNewsController.controller); //delete news
router.post('/global/deleteaccounts', useSession, sessionRefresh, csrf, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_GLOBAL_ACCOUNTS), deleteAccountsController.paramConverter, deleteAccountsController.controller); //account deleting
router.post('/global/editaccount', useSession, sessionRefresh, csrf, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_GLOBAL_ACCOUNTS), editAccountController.paramConverter, editAccountController.controller); //account editing
router.post('/global/editrole', useSession, sessionRefresh, csrf, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_GLOBAL_ROLES), editRoleController.paramConverter, editRoleController.controller); //role editing
router.post('/global/addfilter', useSession, sessionRefresh, csrf, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_GLOBAL_SETTINGS), addFilterController.paramConverter, addFilterController.controller); //add new filter
router.post('/global/editfilter', useSession, sessionRefresh, csrf, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_GLOBAL_SETTINGS), editFilterController.paramConverter, editFilterController.controller); //edit filter
router.post('/global/deletefilter', useSession, sessionRefresh, csrf, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_GLOBAL_SETTINGS), deleteFilterController.paramConverter, deleteFilterController.controller); //delete filter
router.post('/global/settings', geoIp, processIp, useSession, sessionRefresh, csrf, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_GLOBAL_SETTINGS), globalSettingsController.paramConverter, globalSettingsController.controller); //global settings
router.post('/global/clear', useSession, sessionRefresh, csrf, calcPerms, isLoggedIn,
	hasPerms.one(Permissions.MANAGE_GLOBAL_SETTINGS), globalClearController.paramConverter, globalClearController.controller); //global clear

//accounts
router.post('/login', useSession, loginController.paramConverter, loginController.controller);
router.post('/twofactor', useSession, sessionRefresh, csrf, calcPerms, isLoggedIn, twofactorController.paramConverter, twofactorController.controller);
router.post('/logout', useSession, logoutForm);
router.post('/register', geoIp, processIp, useSession, sessionRefresh, calcPerms, verifyCaptcha, registerController.paramConverter, registerController.controller);
router.post('/changepassword', geoIp, processIp, useSession, sessionRefresh, verifyCaptcha, changePasswordController.paramConverter, changePasswordController.controller);
router.post('/resign', useSession, sessionRefresh, csrf, calcPerms, isLoggedIn, resignController.paramConverter, resignController.controller);
router.post('/deleteaccount', useSession, sessionRefresh, csrf, calcPerms, isLoggedIn, deleteAccountController.paramConverter, deleteAccountController.controller);
router.post('/deletesessions', useSession, sessionRefresh, csrf, calcPerms, isLoggedIn, deleteSessionsController.paramConverter, deleteSessionsController.controller);

//block/unblock boards
router.post('/blockboard', useSession, sessionRefresh, csrf, calcPerms, isLoggedIn, blockBoardController.blockBoard);
router.post('/unblockboard', useSession, sessionRefresh, csrf, calcPerms, isLoggedIn, blockBoardController.unblockBoard);
router.get('/blockedboards', useSession, sessionRefresh, calcPerms, isLoggedIn, blockBoardController.getBlockedBoards);
router.post('/approveunblock', useSession, sessionRefresh, csrf, calcPerms, isLoggedIn, hasPerms.one(Permissions.MANAGE_GLOBAL_ACCOUNTS), blockBoardController.approveUnblockRequest);
router.post('/rejectunblock', useSession, sessionRefresh, csrf, calcPerms, isLoggedIn, hasPerms.one(Permissions.MANAGE_GLOBAL_ACCOUNTS), blockBoardController.rejectUnblockRequest);
router.get('/unblockrequests', useSession, sessionRefresh, calcPerms, isLoggedIn, hasPerms.one(Permissions.MANAGE_GLOBAL_ACCOUNTS), blockBoardController.getAllUnblockRequests);

//removes captcha cookie, for refreshing for noscript users
router.post('/newcaptcha', newCaptchaForm);
//solve captcha for block bypass
router.post('/blockbypass', geoIp, processIp, useSession, sessionRefresh, calcPerms, setQueryLanguage, csrf, verifyCaptcha, blockBypassForm);

//poll voting
const Posts = require(__dirname+'/../db/posts.js');
router.post('/vote-poll', geoIp, processIp, useSession, sessionRefresh, async (req, res) => {
	try {
		const { board, postId, option } = req.body;
		const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

		console.log('Poll vote request:', { board, postId, option, ip });

		const result = await Posts.votePoll(board, postId, parseInt(option), ip);

		console.log('Poll vote result:', result);

		if (result.success) {
			return res.json({ success: true });
		} else {
			return res.status(400).json({ success: false, error: result.error });
		}
	} catch (err) {
		console.error('Poll vote error:', err);
		return res.status(500).json({ success: false, error: 'Server error' });
	}
});

router.get('/poll-results', async (req, res) => {
	try {
		const { board, postId } = req.query;
		const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
		
		const results = await Posts.getPollResults(board, postId, ip);
		
		if (!results) {
			return res.status(404).json({ error: 'Poll not found' });
		}
		
		return res.json(results);
	} catch (err) {
		console.error('Poll results error:', err);
		return res.status(500).json({ error: 'Server error' });
	}
});

//blog routes (only /gen/)
const setGenBoard = (req, res, next) => { req.params.board = 'gen'; next(); };
router.post('/board/gen/blog', geoIp, processIp, useSession, sessionRefresh, setGenBoard, Boards.exists, setBoardLanguage, calcPerms, banCheck, referrerCheck, fileMiddlewares.posts, blogController.paramConverter, verifyCaptcha, blogController.create);
router.post('/board/gen/blog/add-entry', geoIp, processIp, useSession, sessionRefresh, setGenBoard, Boards.exists, setBoardLanguage, calcPerms, banCheck, referrerCheck, fileMiddlewares.posts, blogController.paramConverter, verifyCaptcha, blogController.addEntry);
router.post('/board/gen/blog/edit-entry', geoIp, processIp, useSession, sessionRefresh, setGenBoard, Boards.exists, setBoardLanguage, calcPerms, banCheck, referrerCheck, fileMiddlewares.posts, blogController.paramConverter, blogController.editEntry);
router.post('/board/gen/blog/delete-entry', useSession, sessionRefresh, setGenBoard, Boards.exists, setBoardLanguage, blogController.deleteEntry);
router.post('/board/gen/blog/settings', useSession, sessionRefresh, setGenBoard, Boards.exists, setBoardLanguage, blogController.updateSettings);
router.post('/board/gen/blog/delete', useSession, sessionRefresh, setGenBoard, Boards.exists, setBoardLanguage, blogController.delete);
router.post('/board/gen/blog/reply', geoIp, processIp, useSession, sessionRefresh, setGenBoard, Boards.exists, setBoardLanguage, calcPerms, banCheck, blogController.reply);
router.post('/board/gen/blog/moderate-reply', useSession, sessionRefresh, setGenBoard, Boards.exists, setBoardLanguage, blogController.moderateReply);

module.exports = router;

