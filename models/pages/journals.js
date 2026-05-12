'use strict';

const Journals = require(__dirname+'/../../db/journals.js');

module.exports = {

	// List all journals (book-style feed)
	journalsFeed: async (req, res, next) => {
		try {
			const journals = await Journals.getAll(100);
			res.render('journals', {
				journals,
				title: 'Journal Archive'
			});
		} catch (err) {
			next(err);
		}
	},

	// Single journal entry
	journalEntry: async (req, res, next) => {
		try {
			const journal = await Journals.getBySlug(req.params.slug);
			if (!journal) {
				return res.status(404).send('Journal not found');
			}
			
			// Get poll data with user's voting status
			let poll = null;
			if (journal.poll) {
				const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
				poll = await Journals.getPollResults(journal._id, ip);
			}
			
			res.render('journal-entry', {
				journal,
				poll,
				title: journal.title
			});
		} catch (err) {
			next(err);
		}
	},

	// Vote on poll
	journalVote: async (req, res, next) => {
		try {
			const journal = await Journals.getBySlug(req.params.slug);
			if (!journal) {
				return res.status(404).send('Journal not found');
			}
			
			if (!journal.poll) {
				return res.status(400).send('No poll in this journal');
			}
			
			const optionIndex = parseInt(req.body.option);
			const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
			
			const result = await Journals.vote(journal._id, optionIndex, ip);
			
			if (!result.success) {
				// Redirect back with error message
				return res.redirect(`/journals/${journal.slug}.html?voteError=${encodeURIComponent(result.error)}`);
			}
			
			res.redirect(`/journals/${journal.slug}.html?voteSuccess=1`);
		} catch (err) {
			next(err);
		}
	},

	// Create form page
	journalCreate: (req, res) => {
		res.render('journal-create', {
			title: 'New Journal Entry'
		});
	},

	// Create journal entry
	journalCreateSubmit: async (req, res, next) => {
		try {
			const { title, description, content, coverType, coverColor, coverImage, pageStyle, editCode, tags, pollQuestion, pollOptions } = req.body;
			
			// Hash the edit code
			const crypto = require('crypto');
			const editCodeHash = editCode ? crypto.createHash('sha256').update(editCode).digest('hex') : null;
			
			// Build poll if provided
			let poll = null;
			if (pollQuestion && pollOptions && pollOptions.length >= 2) {
				const validOptions = pollOptions.filter(o => o.trim() !== '');
				if (validOptions.length >= 2) {
					poll = {
						question: pollQuestion,
						options: validOptions
					};
				}
			}
			
			const journal = await Journals.create({
				title,
				description,
				content,
				coverType: coverType || 'color',
				coverColor: coverColor || '#2a3f5f',
				coverImage: coverImage || null,
				pageStyle: pageStyle || 'blank',
				editCodeHash,
				tags: tags ? tags.split(',').map(t => t.trim()) : [],
				poll,
				published: true
			});
			res.redirect(`/journals/${journal.slug}.html`);
		} catch (err) {
			next(err);
		}
	},

	// Edit form page
	journalEdit: async (req, res, next) => {
		try {
			const journal = await Journals.getBySlug(req.params.slug);
			if (!journal) {
				return res.status(404).send('Journal not found');
			}
			res.render('journal-edit', {
				journal,
				title: 'Edit Journal'
			});
		} catch (err) {
			next(err);
		}
	},

	// Submit edit
	journalEditSubmit: async (req, res, next) => {
		try {
			const journal = await Journals.getBySlug(req.params.slug);
			if (!journal) {
				return res.status(404).send('Journal not found');
			}
			
			// Verify edit code
			const { title, description, content, coverType, coverColor, coverImage, pageStyle, editCode, tags } = req.body;
			const isValid = await Journals.verifyEditCode(journal._id, editCode);
			
			if (!isValid) {
				return res.status(403).send('Invalid edit code');
			}
			
			await Journals.update(journal._id, {
				title,
				description,
				content,
				coverType,
				coverColor,
				coverImage,
				pageStyle,
				tags: tags ? tags.split(',').map(t => t.trim()) : []
			});
			
			res.redirect(`/journals/${journal.slug}.html`);
		} catch (err) {
			next(err);
		}
	}

};
