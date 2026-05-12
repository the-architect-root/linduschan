'use strict';

const { Blogs } = require(__dirname+'/../../db/')
	, dynamicResponse = require(__dirname+'/../../lib/misc/dynamic.js')
	, moveUpload = require(__dirname+'/../../lib/file/moveupload.js')
	, Mongo = require(__dirname+'/../../db/db.js')
	, config = require(__dirname+'/../../lib/misc/config.js')
	, checkCaptcha = require(__dirname+'/../../lib/captcha/captcha.js')
	, Ratelimits = require(__dirname+'/../../db/ratelimits.js');

module.exports = {

	paramConverter: (req, res, next) => {
		if (req.body.blog) {
			req.body.blog = req.body.blog === 'true' ? true : false;
		}
		next();
	},

	create: async (req, res) => {
		const { __ } = res.locals;
		const { title, description, editCode } = req.body;
		const board = req.params.board;

		// Rate limit blog creation to 1 per 5 minutes per IP
		const ip = res.locals.ip;
		const rateLimitResult = await Ratelimits.incrmentQuota(ip, 'blog_create', 5, 300);
		if (rateLimitResult) {
			return dynamicResponse(req, res, 429, 'message', {
				'title': __('Rate limited'),
				'message': __('You are creating blogs too quickly. Please wait 5 minutes.'),
				'redirect': `/${board}/blogs.html`,
			});
		}

		if (!title || !description || !editCode) {
			return dynamicResponse(req, res, 400, 'message', {
				'title': __('Bad request'),
				'message': __('Title, description, and edit code are required'),
				'redirect': `/${board}/blogs.html`,
			});
		}

		if (editCode.length < 4) {
			return dynamicResponse(req, res, 400, 'message', {
				'title': __('Bad request'),
				'message': __('Edit code must be at least 4 characters'),
				'redirect': `/${board}/blogs.html`,
			});
		}

		if (title.length > 100) {
			return dynamicResponse(req, res, 400, 'message', {
				'title': __('Bad request'),
				'message': __('Title must be under 100 characters'),
				'redirect': `/${board}/blogs.html`,
			});
		}

		try {
			let coverImage = '';
			const coverFile = req.files ? (req.files.cover || req.files.file) : null;
			if (coverFile) {
				const cover = Array.isArray(coverFile) ? coverFile[0] : coverFile;
				const filename = cover.sha256 + cover.extension;
				await moveUpload(cover, filename, 'file');

				try {
					const gm = require('gm');
					const gmPath = require('path').join(require(__dirname+'/../../lib/file/uploaddirectory.js'), 'uploads/images', filename);
					const cropY = parseFloat(req.body.cropY);
					const yPct = isNaN(cropY) ? 50 : Math.max(0, Math.min(100, cropY));
					await new Promise((resolve, reject) => {
						gm(gmPath).size((err, size) => {
							if (err) return reject(err);
							const isWide = size.width / size.height > 1;
							const resizedW = isWide ? Math.round(size.width / size.height * 400) : 400;
							const resizedH = isWide ? 400 : Math.round(size.height / size.width * 400);
							const maxOffset = Math.max(0, resizedH - 400);
							const yOffset = Math.round((yPct / 100) * maxOffset);
							const xOffset = Math.max(0, Math.round((resizedW - 400) / 2));
							gm(gmPath)
								.resize(400, 400, '^')
								.gravity('NorthWest')
								.crop(400, 400, xOffset, yOffset)
								.write(gmPath, (err2) => {
									if (err2) reject(err2);
									else resolve();
								});
						});
					});
				} catch (gmErr) {
					console.warn('GM resize skipped for cover image:', gmErr.message);
				}

				coverImage = filename;
			}

			const { blog } = await Blogs.create(board, {
				title,
				description,
				editCode,
				coverImage,
			});

			return dynamicResponse(req, res, 200, 'message', {
				'title': __('Success'),
				'message': __('Blog created!'),
				'redirect': `/${board}/blog/${blog._id}.html`,
			});
		} catch (err) {
			console.error('Blog creation error:', err);
			return dynamicResponse(req, res, 500, 'message', {
				'title': __('Error'),
				'message': __('Failed to create blog'),
				'redirect': `/${board}/blogs.html`,
			});
		}
	},

	// Add a new entry to an existing blog
	addEntry: async (req, res) => {
		const { entry_title, content, blog_id, editCode, tags } = req.body;
		const board = req.params.board;

		if (!blog_id || !editCode) {
			return res.redirect(`/${board}/blog/${blog_id || ''}.html?error=1`);
		}

		try {
			const blog = await Blogs.get(board, blog_id);
			if (!blog) {
				return res.redirect(`/${board}/blogs.html`);
			}

			if (!Blogs.verifyEditCode(blog, editCode)) {
				return res.redirect(`/${board}/blog/${blog_id}.html?error=invalidcode`);
			}

			if (!content || !content.trim()) {
				return res.redirect(`/${board}/blog/${blog_id}/dashboard.html?error=empty`);
			}

		let contentMedia = [];
		let savedContent = content.trim();
		const entryFiles = req.files ? (req.files.content_media || req.files.file) : null;
		if (entryFiles) {
			const mediaFiles = Array.isArray(entryFiles) ? entryFiles : [entryFiles];
			for (const f of mediaFiles) {
				const filename = f.sha256 + f.extension;
				await moveUpload(f, filename, 'file');
				contentMedia.push({
					filename,
					type: f.mimetype.split('/')[0],
					mimetype: f.mimetype,
				});
				const placeholder = `PLACEHOLDER_${f.name}`;
				const fileUrl = `/file/${filename}`;
				savedContent = savedContent.split(placeholder).join(fileUrl);
			}
		}

			const tagsArr = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];

			const entry = {
				_id: new Mongo.ObjectId(),
				title: entry_title || '',
				content: savedContent,
				contentMedia,
				tags: tagsArr,
				isPublished: req.body.isPublished !== 'false',
				publishedDate: new Date(),
				createdDate: new Date(),
				editedDate: null,
				slug: req.body.entry_slug || '',
			};

			await Blogs.addEntry(board, blog_id, entry);

			return res.redirect(`/${board}/blog/${blog_id}/dashboard.html?saved=1`);
		} catch (err) {
			console.error('Blog add entry error:', err);
			return res.redirect(`/${board}/blog/${blog_id}.html?error=1`);
		}
	},

	// Edit an existing entry
	editEntry: async (req, res) => {
		const { entry_id, entry_title, content, blog_id, editCode, tags, isPublished } = req.body;
		const board = req.params.board;

		if (!blog_id || !entry_id || !editCode) {
			return res.redirect(`/${board}/blog/${blog_id || ''}.html?error=1`);
		}

		try {
			const blog = await Blogs.get(board, blog_id);
			if (!blog) {
				return res.redirect(`/${board}/blogs.html`);
			}

			if (!Blogs.verifyEditCode(blog, editCode)) {
				return res.redirect(`/${board}/blog/${blog_id}.html?error=invalidcode`);
			}

			const existingEntry = blog.entries.find(e => String(e._id) === entry_id);
			if (!existingEntry) {
				return res.redirect(`/${board}/blog/${blog_id}/dashboard.html?error=notfound`);
			}

			let contentMedia = existingEntry.contentMedia || [];
			let savedContent = content !== undefined ? content.trim() : existingEntry.content;
			const entryFiles = req.files ? (req.files.content_media || req.files.file) : null;
			if (entryFiles) {
				const mediaFiles = Array.isArray(entryFiles) ? entryFiles : [entryFiles];
				for (const f of mediaFiles) {
					const filename = f.sha256 + f.extension;
					await moveUpload(f, filename, 'file');
					contentMedia.push({
						filename,
						type: f.mimetype.split('/')[0],
						mimetype: f.mimetype,
					});
					const placeholder = `PLACEHOLDER_${f.name}`;
					const fileUrl = `/file/${filename}`;
					savedContent = savedContent.split(placeholder).join(fileUrl);
				}
			}

			// Handle removed media
			const removeMedia = req.body.remove_media;
			if (removeMedia) {
				const toRemove = removeMedia.split(',');
				contentMedia = contentMedia.filter(m => !toRemove.includes(m.filename));
			}

			const tagsArr = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];

			const updatedEntry = {
				...existingEntry,
				title: entry_title !== undefined ? entry_title : existingEntry.title,
				content: savedContent,
				contentMedia,
				tags: tagsArr,
				isPublished: isPublished === 'true' || isPublished === true,
				editedDate: new Date(),
			};

			await Blogs.updateEntry(board, blog_id, entry_id, updatedEntry);

			return res.redirect(`/${board}/blog/${blog_id}/dashboard.html`);
		} catch (err) {
			console.error('Blog edit entry error:', err);
			return res.redirect(`/${board}/blog/${blog_id}.html?error=1`);
		}
	},

	// Delete an entry
	deleteEntry: async (req, res) => {
		const { entry_id, blog_id, editCode } = req.body;
		const board = req.params.board;

		if (!blog_id || !entry_id || !editCode) {
			return res.redirect(`/${board}/blog/${blog_id || ''}.html?error=1`);
		}

		try {
			const blog = await Blogs.get(board, blog_id);
			if (!blog) {
				return res.redirect(`/${board}/blogs.html`);
			}

			if (!Blogs.verifyEditCode(blog, editCode)) {
				return res.redirect(`/${board}/blog/${blog_id}.html?error=invalidcode`);
			}

			await Blogs.deleteEntry(board, blog_id, entry_id);

			return res.redirect(`/${board}/blog/${blog_id}/dashboard.html`);
		} catch (err) {
			console.error('Blog delete entry error:', err);
			return res.redirect(`/${board}/blog/${blog_id}.html?error=1`);
		}
	},

	// Update blog settings
	updateSettings: async (req, res) => {
		const { blog_id, editCode, title, tagline, description, slug, theme, customCSS, allowComments, commentModeration, displayAuthor, entriesPerPage } = req.body;
		const board = req.params.board;

		if (!blog_id || !editCode) {
			return res.redirect(`/${board}/blogs.html?error=1`);
		}

		try {
			const blog = await Blogs.get(board, blog_id);
			if (!blog) {
				return res.redirect(`/${board}/blogs.html`);
			}

			if (!Blogs.verifyEditCode(blog, editCode)) {
				return res.redirect(`/${board}/blog/${blog_id}/settings.html?error=invalidcode`);
			}

			const updates = {};
			if (title) updates.title = title;
			if (tagline !== undefined) updates.tagline = tagline;
			if (description) updates.description = description;
			if (slug !== undefined) updates.slug = slug;
			if (theme !== undefined) updates.theme = theme;
			if (customCSS !== undefined) updates.customCSS = customCSS;

			updates.settings = {
				allowComments: allowComments === 'true' || allowComments === true,
				commentModeration: commentModeration === 'true' || commentModeration === true,
				displayAuthor: displayAuthor === 'true' || displayAuthor === true,
				entriesPerPage: parseInt(entriesPerPage) || 10,
			};

			await Blogs.update(board, blog_id, updates);

			return res.redirect(`/${board}/blog/${blog_id}/settings.html?saved=1`);
		} catch (err) {
			console.error('Blog settings error:', err);
			return res.redirect(`/${board}/blog/${blog_id}/settings.html?error=1`);
		}
	},

	// Delete entire blog
	delete: async (req, res) => {
		const { blog_id, editCode, confirm } = req.body;
		const board = req.params.board;

		if (!blog_id || !editCode) {
			return res.redirect(`/${board}/blogs.html?error=1`);
		}

		if (confirm !== 'true' && confirm !== true) {
			return res.redirect(`/${board}/blog/${blog_id}/dashboard.html?error=confirm`);
		}

		try {
			const blog = await Blogs.get(board, blog_id);
			if (!blog) {
				return res.redirect(`/${board}/blogs.html`);
			}

			if (!Blogs.verifyEditCode(blog, editCode)) {
				return res.redirect(`/${board}/blog/${blog_id}/dashboard.html?error=invalidcode`);
			}

			await Blogs.delete(board, blog_id);

			return res.redirect(`/${board}/blogs.html?deleted=1`);
		} catch (err) {
			console.error('Blog delete error:', err);
			return res.redirect(`/${board}/blogs.html?error=1`);
		}
	},

	reply: async (req, res) => {
		const { message, blog_id } = req.body;
		const board = req.params.board;

		if (!message || !blog_id) {
			return res.redirect(`/${board}/blog/${blog_id || ''}.html?replyError=1`);
		}

		try {
			const blog = await Blogs.get(board, blog_id);
			if (!blog) {
				return res.redirect(`/${board}/blogs.html`);
			}

			if (blog.settings && blog.settings.allowComments === false) {
				return res.redirect(`/${board}/blog/${blog_id}.html?replyError=disabled`);
			}

			if (res.locals.board && res.locals.board.settings.captchaMode > 0) {
				const captchaInput = req.body.captcha || req.body['g-recaptcha-response'] || req.body['h-captcha-response'];
				const captchaId = req.cookies.captchaid;
				try {
					await checkCaptcha(req, captchaInput, captchaId);
				} catch (err) {
					if (err instanceof Error) {
						throw err;
					}
					const { captchaOptions } = config.get;
					if (!['google', 'hcaptcha', 'yandex'].includes(captchaOptions.type)) {
						res.clearCookie('captchaid');
					}
					return res.redirect(`/${board}/blog/${blog_id}.html?tab=interact`);
				}
				const { captchaOptions } = config.get;
				if (!['google', 'hcaptcha', 'yandex'].includes(captchaOptions.type)) {
					res.clearCookie('captchaid');
				}
			}

			const reply = {
				_id: new Mongo.ObjectId(),
				date: new Date(),
				u: Date.now(),
				message: message,
				isApproved: blog.settings && blog.settings.commentModeration ? false : true,
				isDeleted: false,
			};

			await Blogs.addReply(board, blog_id, reply);

			return res.redirect(`/${board}/blog/${blog_id}.html?tab=interact`);
		} catch (err) {
			console.error('Blog reply error:', err);
			return res.redirect(`/${board}/blog/${blog_id}.html?replyError=1`);
		}
	},

	// Moderate a reply (approve/delete/undelete)
	moderateReply: async (req, res) => {
		const { blog_id, reply_id, action, editCode } = req.body;
		const board = req.params.board;

		if (!blog_id || !reply_id || !action || !editCode) {
			return res.redirect(`/${board}/blog/${blog_id || ''}.html?error=1`);
		}

		try {
			const blog = await Blogs.get(board, blog_id);
			if (!blog) {
				return res.redirect(`/${board}/blogs.html`);
			}

			if (!Blogs.verifyEditCode(blog, editCode)) {
				return res.redirect(`/${board}/blog/${blog_id}.html?error=invalidcode`);
			}

			const reply = blog.replies.find(r => String(r._id) === reply_id);
			if (!reply) {
				return res.redirect(`/${board}/blog/${blog_id}/dashboard.html?error=notfound`);
			}

			switch (action) {
				case 'approve':
					reply.isApproved = true;
					await Blogs.updateReply(board, blog_id, reply_id, reply);
					break;
				case 'delete':
					reply.isDeleted = true;
					await Blogs.updateReply(board, blog_id, reply_id, reply);
					break;
				case 'undelete':
					reply.isDeleted = false;
					await Blogs.updateReply(board, blog_id, reply_id, reply);
					break;
			}

			return res.redirect(`/${board}/blog/${blog_id}/dashboard.html`);
		} catch (err) {
			console.error('Blog moderate reply error:', err);
			return res.redirect(`/${board}/blog/${blog_id}.html?error=1`);
		}
	},

};
