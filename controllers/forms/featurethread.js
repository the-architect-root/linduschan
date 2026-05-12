'use strict';

const { Posts } = require(__dirname+'/../../db/')
	, dynamicResponse = require(__dirname+'/../../lib/misc/dynamic.js')
	, buildQueue = require(__dirname+'/../../lib/build/queue.js');

module.exports = async (req, res) => {

	try {
		const { __ } = res.locals;
		const { board, threadId } = req.body;

		if (!board || !threadId) {
			return dynamicResponse(req, res, 400, 'message', {
				'title': __('Error'),
				'error': __('Missing board or thread ID'),
				'redirect': '/globalmanage/featuredthreads.html'
			});
		}

		// Check if thread exists
		const thread = await Posts.getPost(board, parseInt(threadId));
		if (!thread || thread.thread !== null) {
			return dynamicResponse(req, res, 400, 'message', {
				'title': __('Error'),
				'error': __('Thread not found or not an OP post'),
				'redirect': '/globalmanage/featuredthreads.html'
			});
		}

		// Feature the thread
		await Posts.featureThread(board, parseInt(threadId));

		// Rebuild homepage to reflect changes
		buildQueue.push({
			'task': 'buildHomepage',
			'options': {}
		});

		return dynamicResponse(req, res, 200, 'message', {
			'title': __('Success'),
			'message': __('Thread featured successfully'),
			'redirect': '/globalmanage/featuredthreads.html'
		});
	} catch (err) {
		console.error('Error featuring thread:', err);
		return dynamicResponse(req, res, 500, 'message', {
			'title': __('Error'),
			'error': __('Failed to feature thread'),
			'redirect': '/globalmanage/featuredthreads.html'
		});
	}

};
