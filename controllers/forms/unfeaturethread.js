'use strict';

const { Posts } = require(__dirname+'/../../db/')
	, dynamicResponse = require(__dirname+'/../../lib/misc/dynamic.js')
	, buildQueue = require(__dirname+'/../../lib/build/queue.js');

module.exports = async (req, res) => {

	const { __ } = res.locals;
	const { board, threadId } = req.body;

	if (!board || !threadId) {
		return dynamicResponse(req, res, 400, 'message', {
			'title': __('Error'),
			'error': __('Missing board or thread ID'),
			'redirect': '/globalmanage/featuredthreads.html'
		});
	}

	// Unfeature the thread
	await Posts.unfeatureThread(board, parseInt(threadId));

	// Rebuild homepage to reflect changes
	buildQueue.push({
		'task': 'buildHomepage',
		'options': {}
	});

	return dynamicResponse(req, res, 200, 'message', {
		'title': __('Success'),
		'message': __('Thread unfeatured successfully'),
		'redirect': '/globalmanage/featuredthreads.html'
	});

};
