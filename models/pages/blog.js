'use strict';

const { Blogs } = require(__dirname+'/../../db/')
	, { markdown } = require(__dirname+'/../../lib/post/markdown/markdown.js')
	, { Permissions } = require(__dirname+'/../../lib/permission/permissions.js');

const fullPerms = {
	get: () => true,
};

// Migrate old blog format (flat content string) to new format (entries array)
function migrateBlog(blog) {
	if (!blog) return null;
	if (!blog.entries && blog.content) {
		const rawEntries = blog.content.split('\n---\n').map(c => c.trim()).filter(c => c);
		blog.entries = rawEntries.map((content, i) => ({
			_id: require('crypto').randomBytes(12).toString('hex'),
			title: '',
			content,
			contentMedia: i === 0 ? (blog.contentMedia || []) : [],
			tags: [],
			isPublished: true,
			publishedDate: i === 0 ? blog.date : (blog.editedAt || blog.date),
			createdDate: i === 0 ? blog.date : (blog.editedAt || blog.date),
			editedDate: null,
		}));
	} else if (blog.contentMedia && blog.contentMedia.length > 0 && blog.entries && blog.entries.length > 0) {
		if (!blog.entries[0].contentMedia || blog.entries[0].contentMedia.length === 0) {
			blog.entries[0].contentMedia = blog.contentMedia;
		}
	}
	if (!blog.settings) {
		blog.settings = {
			allowComments: true,
			commentModeration: false,
			displayAuthor: true,
			entriesPerPage: 10,
		};
	}
	if (!blog.customCSS) blog.customCSS = '';
	if (!blog.theme) blog.theme = '';
	if (!blog.tagline) blog.tagline = '';
	if (!blog.slug) blog.slug = '';
	if (!blog.entries) blog.entries = [];
	return blog;
}

module.exports = {

	list: async (req, res, next) => {
		const { board } = req.params;

		try {
			const blogs = await Blogs.getAll(board);
			blogs.forEach(migrateBlog);
			res.locals.blogs = blogs;
			next();
		} catch (err) {
			console.error('Blog list error:', err);
			return res.status(500).render('message', {
				title: 'Error',
				message: 'Failed to load blogs',
				redirect: `/${board}/`,
			});
		}
	},

	view: async (req, res, next) => {
		const { board, blogId } = req.params;

		try {
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

			migrateBlog(blog);

			const allEntries = blog.entries.map((entry, i) => {
				const processed = markdown(entry.content || '', fullPerms);
				return {
					_id: entry._id,
					index: i,
					title: entry.title,
					slug: entry.slug,
					content: processed,
					contentMedia: entry.contentMedia || [],
					tags: entry.tags || [],
					isPublished: entry.isPublished !== false,
					publishedDate: entry.publishedDate || blog.date,
					createdDate: entry.createdDate || blog.date,
					editedDate: entry.editedDate,
				};
			}).filter(e => e.isPublished || req.query.preview);

			// Sort oldest first (chronological)
			allEntries.sort((a, b) => new Date(a.createdDate) - new Date(b.createdDate));

			// Paginate
			const entriesPerPage = blog.settings.entriesPerPage || 10;
			const entryPage = parseInt(req.query.page) || 1;
			const totalEntries = allEntries.length;
			const totalEntryPages = Math.ceil(totalEntries / entriesPerPage) || 1;
			const entries = allEntries.slice((entryPage - 1) * entriesPerPage, entryPage * entriesPerPage);

			res.locals.blog = blog;
			res.locals.entries = entries;
			res.locals.entryPage = entryPage;
			res.locals.totalEntryPages = totalEntryPages;
			res.locals.activeTab = req.query.tab === 'interact' ? 'interact' : 'blog';
			next();
		} catch (err) {
			console.error('Blog view error:', err);
			return res.status(500).render('message', {
				title: 'Error',
				message: 'Failed to load blog',
				redirect: `/${board}/blogs`,
			});
		}
	},

};
