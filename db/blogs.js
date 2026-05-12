'use strict';

const Mongo = require(__dirname+'/db.js')
	, { randomBytes, createHash } = require('crypto')
	, db = Mongo.db.collection('blogs');

module.exports = {

	db,

	create: async (board, data) => {
		const editCodeHash = createHash('sha256').update(data.editCode).digest('hex');

		const blog = {
			board: board,
			title: data.title,
			description: data.description,
			author: data.author || 'Anon',
			coverImage: data.coverImage || '',
			entries: [],
			editCodeHash: editCodeHash,
			settings: {
				allowComments: true,
				commentModeration: false,
				displayAuthor: true,
				entriesPerPage: 10,
			},
			date: new Date(),
			u: Date.now(),
			editedAt: null,
			replies: [],
		};

		if (data.settings) {
			Object.assign(blog.settings, data.settings);
		}

		const result = await db.insertOne(blog);
		return { blog: { ...blog, _id: result.insertedId }, editCode: data.editCode };
	},

	verifyEditCode: (blog, editCode) => {
		const hash = createHash('sha256').update(editCode).digest('hex');
		return blog.editCodeHash === hash;
	},

	get: (board, id) => {
		return db.findOne({ board, _id: Mongo.ObjectId(id) });
	},

	getBySlug: (board, slug) => {
		return db.findOne({ board, slug });
	},

	getAll: (board) => {
		return db.find({ board }).sort({ u: -1 }).toArray();
	},

	getPublished: (board) => {
		return db.find({ board }).sort({ u: -1 }).toArray();
	},

	update: (board, id, updates) => {
		return db.updateOne(
			{ board, _id: Mongo.ObjectId(id) },
			{ $set: { ...updates, editedAt: new Date() } }
		);
	},

	delete: (board, id) => {
		return db.deleteOne({ board, _id: Mongo.ObjectId(id) });
	},

	addEntry: (board, blogId, entry) => {
		return db.updateOne(
			{ board, _id: Mongo.ObjectId(blogId) },
			{ $push: { entries: entry }, $set: { editedAt: new Date() } }
		);
	},

	updateEntry: (board, blogId, entryId, updates) => {
		return db.updateOne(
			{ board, _id: Mongo.ObjectId(blogId), 'entries._id': Mongo.ObjectId(entryId) },
			{ $set: { 'entries.$': updates, editedAt: new Date() } }
		);
	},

	deleteEntry: (board, blogId, entryId) => {
		return db.updateOne(
			{ board, _id: Mongo.ObjectId(blogId) },
			{ $pull: { entries: { _id: Mongo.ObjectId(entryId) } }, $set: { editedAt: new Date() } }
		);
	},

	addReply: (board, blogId, reply) => {
		return db.updateOne(
			{ board, _id: Mongo.ObjectId(blogId) },
			{ $push: { replies: reply } }
		);
	},

	updateReply: (board, blogId, replyId, updates) => {
		return db.updateOne(
			{ board, _id: Mongo.ObjectId(blogId), 'replies._id': Mongo.ObjectId(replyId) },
			{ $set: { 'replies.$': updates } }
		);
	},

	deleteReply: (board, blogId, replyId) => {
		return db.updateOne(
			{ board, _id: Mongo.ObjectId(blogId) },
			{ $pull: { replies: { _id: Mongo.ObjectId(replyId) } } }
		);
	},

	deleteAllReplies: (board, blogId) => {
		return db.updateOne(
			{ board, _id: Mongo.ObjectId(blogId) },
			{ $set: { replies: [] } }
		);
	},

};
