'use strict';

const express  = require('express')
	, router = express.Router({ caseSensitive: true })
	, Boards = require(__dirname+'/../db/boards.js')
	, Posts = require(__dirname+'/../db/posts.js')
	//middlewares
	, processIp = require(__dirname+'/../lib/middleware/ip/processip.js')
	, geoIp = require(__dirname+'/../lib/middleware/ip/geoip.js')
	, calcPerms = require(__dirname+'/../lib/middleware/permission/calcpermsmiddleware.js')
	, { Permissions } = require(__dirname+'/../lib/permission/permissions.js')
	, hasPerms = require(__dirname+'/../lib/middleware/permission/haspermsmiddleware.js')
	, isLoggedIn = require(__dirname+'/../lib/middleware/permission/isloggedin.js')
	, paramConverter = require(__dirname+'/../lib/middleware/input/paramconverter.js')
	, useSession = require(__dirname+'/../lib/middleware/permission/usesession.js')
	, sessionRefresh = require(__dirname+'/../lib/middleware/permission/sessionrefresh.js')
	, csrf = require(__dirname+'/../lib/middleware/misc/csrfmiddleware.js')
	, setMinimal = require(__dirname+'/../lib/middleware/misc/setminimal.js')
	, blockedBoard = require(__dirname+'/../lib/middleware/blockedboard.js')
	, { setBoardLanguage, setQueryLanguage } = require(__dirname+'/../lib/middleware/locale/locale.js')
	//page models
	, { manageRecent, manageReports, manageAssets, manageSettings, manageBans, manageFilters, editFilter, editCustomPage, manageMyPermissions,
		manageBoard, manageThread, manageLogs, manageCatalog, manageCustomPages, manageStaff, editStaff, editPost } = require(__dirname+'/../models/pages/manage/')
	, { globalManageSettings, globalManageReports, globalManageBans, globalManageBoards, globalManageFilters, globalEditFilter, editNews, editAccount, editRole,
		globalManageRecent, globalManageAccounts, globalManageNews, globalManageLogs, globalManageRoles } = require(__dirname+'/../models/pages/globalmanage/')
	, { changePassword, blockBypass, register, account, sessions, setupTwoFactor, myPermissions, home, login, board, catalog, banners, boardSettings, globalSettings, customPage, csrfPage, noncePage, randombanner, news, captchaPage, captcha, thread, modlog, modloglist, boardlist, blockedBoards, overboard, overboardCatalog, featuredthreads, journals, catalogviewer } = require(__dirname+'/../models/pages/index.js')
	, blogModel = require(__dirname+'/../models/pages/blog.js')
	, threadParamConverter = paramConverter({ processThreadIdParam: true })
	, logParamConverter = paramConverter({ processDateParam: true })
	, filterParamConverter = paramConverter({ objectIdParams: ['filterid'] })
	, newsParamConverter = paramConverter({ objectIdParams: ['newsid'] })
	, roleParamConverter = paramConverter({ objectIdParams: ['roleid'] })
	, custompageParamConverter = paramConverter({ objectIdParams: ['custompageid'] });

//homepage
router.get('/', (req, res) => res.redirect('/index.html'));
router.get('/index.html', home);

//news page
router.get('/news.html', news);

//middleware to set lain theme for specific pages
const setLainTheme = (req, res, next) => {
	res.locals.defaultTheme = 'yotsuba';
	next();
};

//board list
router.get('/boards.(html|json)', (req, res) => res.redirect('/'));

//overboard
router.get('/overboard.(html|json)', setLainTheme, overboard); //overboard
router.get('/catalog.(html|json)', setLainTheme, overboardCatalog); //overboard catalog view
router.get('/overboard/catalog.(html|json)', setLainTheme, overboardCatalog); //overboard catalog view (alternative path)

//board pages
router.get('/:board/index.html', Boards.exists, setBoardLanguage, blockedBoard, board); //index
router.get('/:board/:page(1[0-9]{1,}|[2-9][0-9]{0,}|index).(html|json)', Boards.exists, setBoardLanguage, blockedBoard, board); //index
router.get('/:board/thread/:id([1-9][0-9]{0,}).(html|json)', Boards.exists, setBoardLanguage, blockedBoard, threadParamConverter, Posts.threadExistsMiddleware, thread); //thread view
router.get('/:board/catalog.(html|json)', Boards.exists, setBoardLanguage, blockedBoard, catalog); //catalog
router.get('/:board/logs.(html|json)', Boards.exists, setBoardLanguage, modloglist);//modlog list
router.get('/:board/logs/:date(\\d{2}-\\d{2}-\\d{4}).(html|json)', Boards.exists, setBoardLanguage, logParamConverter, modlog); //daily log
router.get('/:board/page/:page.(html|json)', Boards.exists, setBoardLanguage, customPage); //board custom page
router.get('/:board/banners.(html|json)', Boards.exists, setBoardLanguage, banners); //banners
router.get('/:board/settings.json', Boards.exists, setBoardLanguage, boardSettings); //public board settings
router.get('/settings.json', globalSettings); //public global settings
router.get('/randombanner', randombanner); //random banner

//board manage pages
router.get('/:board/manage.html', (req, res) => res.redirect(`/${req.params.board}/manage/index.html`));
router.get('/:board/manage/catalog.html', useSession, sessionRefresh, isLoggedIn, Boards.exists, setBoardLanguage, calcPerms,
	hasPerms.one(Permissions.MANAGE_BOARD_GENERAL), csrf, manageCatalog);
router.get('/:board/manage/:page(1[0-9]{1,}|[2-9][0-9]{0,}|index).html', useSession, sessionRefresh, isLoggedIn, Boards.exists, setBoardLanguage, calcPerms,
	hasPerms.one(Permissions.MANAGE_BOARD_GENERAL), csrf, manageBoard);
router.get('/:board/manage/thread/:id([1-9][0-9]{0,}).html', useSession, sessionRefresh, isLoggedIn, Boards.exists, setBoardLanguage, threadParamConverter, calcPerms,
	hasPerms.one(Permissions.MANAGE_BOARD_GENERAL), csrf, Posts.threadExistsMiddleware, manageThread);
router.get('/:board/manage/editpost/:id([1-9][0-9]{0,}).html', useSession, sessionRefresh, isLoggedIn, Boards.exists, setBoardLanguage, threadParamConverter, calcPerms,
	hasPerms.one(Permissions.MANAGE_BOARD_GENERAL), csrf, Posts.postExistsMiddleware, editPost);
router.get('/:board/manage/reports.(html|json)', useSession, sessionRefresh, isLoggedIn, Boards.exists, setBoardLanguage, calcPerms,
	hasPerms.one(Permissions.MANAGE_BOARD_GENERAL), csrf, manageReports);
router.get('/:board/manage/recent.(html|json)', useSession, sessionRefresh, isLoggedIn, Boards.exists, setBoardLanguage, calcPerms,
	hasPerms.one(Permissions.MANAGE_BOARD_GENERAL), csrf, manageRecent);
router.get('/:board/manage/mypermissions.html', useSession, sessionRefresh, isLoggedIn, Boards.exists, setBoardLanguage, calcPerms,
	hasPerms.one(Permissions.MANAGE_BOARD_GENERAL), manageMyPermissions);
router.get('/:board/manage/logs.html', useSession, sessionRefresh, isLoggedIn, Boards.exists, setBoardLanguage, calcPerms,
	hasPerms.one(Permissions.MANAGE_BOARD_LOGS), csrf, manageLogs);
router.get('/:board/manage/bans.html', useSession, sessionRefresh, isLoggedIn, Boards.exists, setBoardLanguage, calcPerms,
	hasPerms.one(Permissions.MANAGE_BOARD_BANS), csrf, manageBans);
router.get('/:board/manage/settings.html', useSession, sessionRefresh, isLoggedIn, Boards.exists, setBoardLanguage, calcPerms,
	hasPerms.one(Permissions.MANAGE_BOARD_SETTINGS), csrf, manageSettings);
router.get('/:board/manage/assets.html', useSession, sessionRefresh, isLoggedIn, Boards.exists, setBoardLanguage, calcPerms,
	hasPerms.one(Permissions.MANAGE_BOARD_CUSTOMISATION), csrf, manageAssets);
router.get('/:board/manage/custompages.html', useSession, sessionRefresh, isLoggedIn, Boards.exists, setBoardLanguage, calcPerms,
	hasPerms.one(Permissions.MANAGE_BOARD_CUSTOMISATION), csrf, manageCustomPages);
router.get('/:board/manage/editcustompage/:custompageid([a-f0-9]{24}).html', useSession, sessionRefresh, isLoggedIn, Boards.exists, setBoardLanguage, calcPerms,
	hasPerms.one(Permissions.MANAGE_BOARD_CUSTOMISATION), csrf, custompageParamConverter, editCustomPage);
router.get('/:board/manage/staff.html', useSession, sessionRefresh, isLoggedIn, Boards.exists, setBoardLanguage, calcPerms,
	hasPerms.one(Permissions.MANAGE_BOARD_STAFF), csrf, manageStaff);
router.get('/:board/manage/editstaff/:staffusername([a-zA-Z0-9]{1,50}).html', useSession, sessionRefresh, isLoggedIn, Boards.exists, setBoardLanguage, calcPerms,
	hasPerms.one(Permissions.MANAGE_BOARD_STAFF), csrf, editStaff);
router.get('/:board/manage/filters.html', useSession, sessionRefresh, isLoggedIn, Boards.exists, setBoardLanguage, calcPerms,
	hasPerms.one(Permissions.MANAGE_BOARD_SETTINGS), csrf, manageFilters);
router.get('/:board/manage/editfilter/:filterid([a-f0-9]{24}).html', useSession, sessionRefresh, isLoggedIn, Boards.exists, setBoardLanguage, calcPerms,
	hasPerms.one(Permissions.MANAGE_BOARD_SETTINGS), csrf, filterParamConverter, editFilter);

//global manage pages
router.get('/globalmanage/reports.(html|json)', useSession, sessionRefresh, isLoggedIn, calcPerms,
	hasPerms.one(Permissions.MANAGE_GLOBAL_GENERAL), csrf, globalManageReports);
router.get('/globalmanage/recent.(html|json)', useSession, sessionRefresh, isLoggedIn, calcPerms,
	hasPerms.one(Permissions.MANAGE_GLOBAL_GENERAL), csrf, globalManageRecent);
router.get('/globalmanage/globallogs.html', useSession, sessionRefresh, isLoggedIn, calcPerms,
	hasPerms.one(Permissions.MANAGE_GLOBAL_LOGS), csrf, globalManageLogs);
router.get('/globalmanage/bans.html', useSession, sessionRefresh, isLoggedIn, calcPerms,
	hasPerms.one(Permissions.MANAGE_GLOBAL_BANS), csrf, globalManageBans);
router.get('/globalmanage/boards.(html|json)', useSession, sessionRefresh, isLoggedIn, calcPerms,
	hasPerms.one(Permissions.MANAGE_GLOBAL_BOARDS), globalManageBoards);
router.get('/globalmanage/news.html', useSession, sessionRefresh, isLoggedIn, calcPerms,
	hasPerms.one(Permissions.MANAGE_GLOBAL_NEWS), csrf, globalManageNews);
router.get('/globalmanage/accounts.html', useSession, sessionRefresh, isLoggedIn, calcPerms,
	hasPerms.one(Permissions.MANAGE_GLOBAL_ACCOUNTS), csrf, globalManageAccounts);
router.get('/globalmanage/roles.(html|json)', useSession, sessionRefresh, isLoggedIn, calcPerms,
	hasPerms.one(Permissions.MANAGE_GLOBAL_ROLES), csrf, globalManageRoles);
router.get('/globalmanage/filters.html', useSession, sessionRefresh, isLoggedIn, calcPerms,
	hasPerms.one(Permissions.MANAGE_GLOBAL_SETTINGS), csrf, globalManageFilters);
router.get('/globalmanage/settings.html', useSession, sessionRefresh, isLoggedIn, calcPerms,
	hasPerms.one(Permissions.MANAGE_GLOBAL_SETTINGS), csrf, globalManageSettings);
router.get('/globalmanage/featuredthreads.html', useSession, sessionRefresh, isLoggedIn, calcPerms,
	hasPerms.one(Permissions.MANAGE_GLOBAL_SETTINGS), csrf, featuredthreads);
router.get('/globalmanage/editnews/:newsid([a-f0-9]{24}).html', useSession, sessionRefresh, isLoggedIn, calcPerms,
	hasPerms.one(Permissions.MANAGE_GLOBAL_NEWS), csrf, newsParamConverter, editNews);
router.get('/globalmanage/editfilter/:filterid([a-f0-9]{24}).html', useSession, sessionRefresh, isLoggedIn, calcPerms,
	hasPerms.one(Permissions.MANAGE_GLOBAL_SETTINGS), csrf, filterParamConverter, globalEditFilter);
router.get('/globalmanage/editaccount/:accountusername([a-zA-Z0-9]{1,50}).html', useSession, sessionRefresh, isLoggedIn, calcPerms,
	hasPerms.one(Permissions.MANAGE_GLOBAL_ACCOUNTS), csrf, editAccount);
router.get('/globalmanage/editrole/:roleid([a-f0-9]{24}).html', useSession, sessionRefresh, isLoggedIn, calcPerms,
	hasPerms.one(Permissions.MANAGE_GLOBAL_ROLES), csrf, roleParamConverter, editRole);

//captcha
router.get('/captcha', geoIp, processIp, captcha); //get captcha image and cookie
router.get('/captcha.html', captchaPage); //iframed for noscript users
router.get('/bypass.html', useSession, csrf, blockBypass); //block bypass page
router.get('/bypass_minimal.html', setMinimal, setQueryLanguage, useSession, csrf, blockBypass); //block bypass page

//accounts
router.get('/account.html', useSession, sessionRefresh, isLoggedIn, calcPerms, csrf, setLainTheme, account);
router.get('/mypermissions.html', useSession, sessionRefresh, isLoggedIn, calcPerms, myPermissions);
router.get('/twofactor.html', useSession, sessionRefresh, isLoggedIn, calcPerms, csrf, setupTwoFactor);
router.get('/sessions.html', useSession, sessionRefresh, isLoggedIn, calcPerms, csrf, sessions);
router.get('/blockedboards.html', useSession, sessionRefresh, isLoggedIn, calcPerms, csrf, blockedBoards);

router.get('/nonce/:address([a-zA-Z0-9]{42}).json', noncePage); //nonce for web3 logins
router.get('/login.html', login);
router.get('/register.html', register);
router.get('/changepassword.html', changePassword);
router.get('/api/catalog-viewer.json', catalogviewer);
router.get('/csrf.json', useSession, sessionRefresh, isLoggedIn, csrf, csrfPage); //just the token, for 3rd party stuff posting

//public journals (viewable by everyone)
router.get('/journals.html', useSession, sessionRefresh, csrf, journals.journalsFeed);
router.get('/journals/:slug([a-z0-9-]+).html', useSession, sessionRefresh, csrf, journals.journalEntry);
router.post('/journals/:slug([a-z0-9-]+)/vote.html', useSession, sessionRefresh, csrf, journals.journalVote);
//protected journal creation
router.get('/journals/new.html', useSession, sessionRefresh, isLoggedIn, calcPerms, csrf, journals.journalCreate);
router.post('/journals/new.html', useSession, sessionRefresh, isLoggedIn, calcPerms, csrf, journals.journalCreateSubmit);
router.get('/journals/:slug([a-z0-9-]+)/edit.html', useSession, sessionRefresh, csrf, journals.journalEdit);
router.post('/journals/:slug([a-z0-9-]+)/edit.html', useSession, sessionRefresh, csrf, journals.journalEditSubmit);

const blogOnlyGen = (req, res, next) => {
	if (req.params.board !== 'gen') {
		return res.redirect(`/${req.params.board}/`);
	}
	next();
};

//blog dashboard model
const blogDashboard = async (req, res, next) => {
	const { board, blogId } = req.params;
	try {
		const Blogs = require(__dirname+'/../db/blogs.js');
		let blog = await Blogs.get(board, blogId);
		if (!blog) {
			blog = await Blogs.getBySlug(board, blogId);
		}
		if (!blog) {
			return res.status(404).render('message', {
				title: 'Not found',
				message: 'Blog not found',
				redirect: `/${board}/blogs`,
			});
		}
		res.locals.blog = blog;

		// Paginate replies
		const page = parseInt(req.query.page) || 1;
		const limit = 20;
		const totalReplies = blog.replies ? blog.replies.length : 0;
		const totalPages = Math.ceil(totalReplies / limit) || 1;
		const replies = blog.replies ? blog.replies.slice().reverse().slice((page - 1) * limit, page * limit) : [];
		res.locals.replies = replies;
		res.locals.replyPage = page;
		res.locals.replyTotalPages = totalPages;

		next();
	} catch (err) {
		console.error('Blog dashboard error:', err);
		return res.status(500).render('message', {
			title: 'Error',
			message: 'Failed to load dashboard',
			redirect: `/${board}/blogs`,
		});
	}
};

//blog routes (only for /gen/ board)
router.get('/:board/blogs.html', blogOnlyGen, Boards.exists, setBoardLanguage, blockedBoard, blogModel.list, (req, res) => res.render('blog-list', {
	board: res.locals.board,
	blogs: res.locals.blogs,
}));
router.get('/:board/blog/create.html', blogOnlyGen, (req, res) => res.redirect(`/${req.params.board}/blogs.html`));
router.get('/:board/blog/:blogId/edit.html', blogOnlyGen, Boards.exists, setBoardLanguage, blockedBoard, blogModel.view, (req, res) => res.render('blog-edit', {
	board: res.locals.board,
	blog: res.locals.blog,
}));
router.get('/:board/blog/:blogId.html', blogOnlyGen, Boards.exists, setBoardLanguage, blockedBoard, blogModel.view, (req, res) => res.render('blog-view', {
	board: res.locals.board,
	blog: res.locals.blog,
	activeTab: req.query.tab || 'blog',
}));
router.get('/:board/blog/:blogId/dashboard.html', blogOnlyGen, Boards.exists, setBoardLanguage, blockedBoard, blogDashboard, (req, res) => res.render('blog-dashboard', {
	board: res.locals.board,
	blog: res.locals.blog,
	replies: res.locals.replies,
	replyPage: res.locals.replyPage,
	replyTotalPages: res.locals.replyTotalPages,
	error: req.query.error,
	saved: req.query.saved,
}));
router.get('/:board/blog/:blogId/settings.html', blogOnlyGen, Boards.exists, setBoardLanguage, blockedBoard, blogModel.view, (req, res) => res.render('blog-settings', {
	board: res.locals.board,
	blog: res.locals.blog,
	saved: req.query.saved,
	error: req.query.error,
}));
router.get('/:board/blog/:blogId/entry/:entryId/edit.html', blogOnlyGen, Boards.exists, setBoardLanguage, blockedBoard, blogModel.view, (req, res) => res.render('blog-entry-edit', {
	board: res.locals.board,
	blog: res.locals.blog,
	entryId: req.params.entryId,
}));

//board default redirect - must come after specific routes
router.get('/:board/', Boards.exists, (req, res) => res.redirect(`/${req.params.board}/catalog.html`)); //redirect to catalog by default

module.exports = router;
