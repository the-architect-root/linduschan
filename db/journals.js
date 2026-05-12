'use strict';

const Mongo = require(__dirname+'/db.js')
	, db = Mongo.db.collection('journals');

module.exports = {

	db,

	getAll: (limit = 50) => {
		return db.find({}).sort({date: -1}).limit(limit).toArray();
	},

	getById: (id) => {
		return db.findOne({ _id: new Mongo.ObjectId(id) });
	},

	getBySlug: (slug) => {
		return db.findOne({ slug: slug });
	},

	create: async (data) => {
		const now = new Date();
		const slug = data.title.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '')
			.substring(0, 50);
		
		const doc = {
			title: data.title,
			slug: slug,
			description: data.description || '',
			content: data.content,
			coverType: data.coverType || 'color',
			coverColor: data.coverColor || '#2a3f5f',
			coverImage: data.coverImage || null,
			pageStyle: data.pageStyle || 'blank',
			editCodeHash: data.editCodeHash,
			tags: data.tags || [],
			poll: data.poll || null,
			pollVotes: [],
			date: now,
			updated: now,
			published: data.published !== false
		};
		
		const result = await db.insertOne(doc);
		return { ...doc, _id: result.insertedId };
	},

	update: async (id, data) => {
		const updates = {
			updated: new Date()
		};
		if (data.title) updates.title = data.title;
		if (data.content) updates.content = data.content;
		if (data.coverImage) updates.coverImage = data.coverImage;
		if (data.tags) updates.tags = data.tags;
		if (data.published !== undefined) updates.published = data.published;
		
		return db.updateOne(
			{ _id: new Mongo.ObjectId(id) },
			{ $set: updates }
		);
	},

	delete: (id) => {
		return db.deleteOne({ _id: new Mongo.ObjectId(id) });
	},

	totalJournals: () => {
		return db.countDocuments({ published: true });
	},

	verifyEditCode: async (id, code) => {
		const crypto = require('crypto');
		const journal = await db.findOne({ _id: new Mongo.ObjectId(id) });
		if (!journal || !journal.editCodeHash) {
			return false;
		}
		const hash = crypto.createHash('sha256').update(code).digest('hex');
		return hash === journal.editCodeHash;
	},

	// Check if IP has already voted
	hasVoted: async (id, ip) => {
		const journal = await db.findOne({ _id: new Mongo.ObjectId(id) });
		if (!journal || !journal.pollVotes) return false;
		return journal.pollVotes.some(v => v.ip === ip);
	},

	// Record a vote with IP
	vote: async (id, optionIndex, ip) => {
		const journal = await db.findOne({ _id: new Mongo.ObjectId(id) });
		if (!journal) return { success: false, error: 'Journal not found' };
		if (!journal.poll) return { success: false, error: 'No poll in this journal' };
		
		// Check if already voted
		const alreadyVoted = journal.pollVotes && journal.pollVotes.some(v => v.ip === ip);
		if (alreadyVoted) {
			return { success: false, error: 'Already voted from this IP' };
		}
		
		// Record vote
		await db.updateOne(
			{ _id: new Mongo.ObjectId(id) },
			{ $push: { pollVotes: { ip: ip, option: optionIndex, date: new Date() } } }
		);
		
		return { success: true };
	},

	// Get poll results
	getPollResults: async (id, ip) => {
		const journal = await db.findOne({ _id: new Mongo.ObjectId(id) });
		if (!journal || !journal.poll) return null;
		
		const votes = journal.pollVotes || [];
		const hasVoted = votes.some(v => v.ip === ip);
		
		// Count votes per option
		const results = journal.poll.options.map((opt, idx) => ({
			option: opt,
			count: votes.filter(v => v.option === idx).length,
			percentage: votes.length > 0 ? Math.round((votes.filter(v => v.option === idx).length / votes.length) * 100) : 0
		}));
		
		return {
			question: journal.poll.question,
			options: journal.poll.options,
			totalVotes: votes.length,
			hasVoted: hasVoted,
			results: results
		};
	}

};
