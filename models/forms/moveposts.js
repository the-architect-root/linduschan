'use strict';

const uploadDirectory = require(__dirname+'/../../lib/file/uploaddirectory.js')
	, { remove, copy, ensureDir, pathExists } = require('fs-extra')
	, { Posts } = require(__dirname+'/../../db/')
	, Socketio = require(__dirname+'/../../lib/misc/socketio.js')
	, { prepareMarkdown } = require(__dirname+'/../../lib/post/markdown/markdown.js')
	, messageHandler = require(__dirname+'/../../lib/post/message.js')
	, { createHash } = require('crypto');

module.exports = async (req, res) => {

	const { __ } = res.locals;
	const { threads, postIds, postMongoIds } = res.locals.posts
		.sort((a, b) => {
			return a.date - b.date; //could do postId, doesn't really matter.
		}).reduce((acc, p) => {
			acc.postIds.push(p.postId);
			acc.postMongoIds.push(p._id);
			if (p.thread === null) {
				acc.threads.push(p);
			}
			return acc;
		}, { threads: [], postIds: [], postMongoIds: [] });

	//maybe should filter these? because it will include threads from which child posts are already fetched in the action handler, unlike the deleteposts model
	const moveEmits = res.locals.posts.reduce((acc, post) => {
		acc.push({
			room: `${post.board}-${post.thread || post.postId}`,
			postId: post.postId,
		});
		return acc;
	}, []);

	const backlinkRebuilds = new Set();
	const bulkWrites = [];

	//remove backlinks from selected posts that link to unselected posts
	bulkWrites.push({
		'updateMany': {
			'filter': {
				'_id': {
					'$in': postMongoIds
				}
			},
			'update': {
				'$pull': {
					'backlinks': {
						'postId': {
							'$nin': postIds
						}
					}
				}
			}
		}
	});

	for (let j = 0; j < res.locals.posts.length; j++) {
		const post = res.locals.posts[j];
//note: needs debugging
//		if (post.crossquotes.filter(c => c.thread === req.body.move_to_thread).length > 0) {
			//a crossquote is in the thread we move to, so need to remarkup and add backlinks to those posts
		backlinkRebuilds.add(post._id);
//		}
		//get backlinks for posts to remarkup
		for (let i = 0; i < post.backlinks.length; i++) {
			backlinkRebuilds.add(post.backlinks[i]._id);
		}
		//remove dead backlinks to this post
		if (post.quotes.length > 0) {
			backlinkRebuilds.add(post._id);
			bulkWrites.push({
				'updateMany': {
					'filter': {
						'_id': {
							'$in': post.quotes.map(q => q._id)
						}
					},
					'update': {
						'$pull': {
							'backlinks': {
								'postId': post.postId
							}
						}
					}
				}
			});
		}
	}
	
	//increase file/reply count in thread we are moving the posts to
	if (!res.locals.destinationBoard) {
		//recalculateThreadMetadata will handle cross board moves
		const { replyposts, replyfiles } = res.locals.posts.reduce((acc, p) => {
			acc.replyposts += 1;
			acc.replyfiles += p.files.length;
			return acc;
		}, { replyposts: 0, replyfiles: 0 });
		bulkWrites.push({
			'updateOne': {
				'filter': {
					'postId': req.body.move_to_thread,
					'board': req.params.board,
				},
				'update': {
					'$inc': {
						'replyposts': replyposts,
						'replyfiles': replyfiles,
					}
				}
			}
		});
	}

	const destinationBoard = res.locals.destinationBoard ? res.locals.destinationBoard._id : req.params.board;
	const crossBoard = destinationBoard !== req.params.board;
	let destinationThreadId = res.locals.destinationThread ? res.locals.destinationThread.postId : (crossBoard ? null : postIds[0])
		, movedPosts = 0;
	({ destinationThreadId, movedPosts } = await Posts.move(postMongoIds, crossBoard, destinationThreadId, destinationBoard));

	// Copy files to destination board directory for cross-board moves
	if (crossBoard) {
		const sourceBoard = req.params.board;
		for (const post of res.locals.posts) {
			if (post.files && post.files.length > 0) {
				for (const file of post.files) {
					// Determine source file paths (check both new board-specific and old fallback paths)
					const subfolder = file.mimetype && (file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/'))
						? 'uploads/videos'
						: 'uploads/images';
					
					const newSourceFilePath = `${uploadDirectory}/${sourceBoard}/${subfolder}/${file.filename}`;
					const oldSourceFilePath = `${uploadDirectory}/${subfolder}/${file.filename}`;
					
					// Use whichever path exists
					let sourceFilePath = null;
					if (await pathExists(newSourceFilePath)) {
						sourceFilePath = newSourceFilePath;
					} else if (await pathExists(oldSourceFilePath)) {
						sourceFilePath = oldSourceFilePath;
					}

					const newSourceThumbPath = file.hasThumb ? `${uploadDirectory}/${sourceBoard}/file/thumb/${file.hash}${file.thumbextension}` : null;
					const oldSourceThumbPath = file.hasThumb ? `${uploadDirectory}/file/thumb/${file.hash}${file.thumbextension}` : null;
					
					let sourceThumbPath = null;
					if (newSourceThumbPath && await pathExists(newSourceThumbPath)) {
						sourceThumbPath = newSourceThumbPath;
					} else if (oldSourceThumbPath && await pathExists(oldSourceThumbPath)) {
						sourceThumbPath = oldSourceThumbPath;
					}

					// Determine destination file paths (always use new board-specific paths)
					const destFileFolder = `${destinationBoard}/${subfolder}`;
					const destFilePath = `${uploadDirectory}/${destFileFolder}/${file.filename}`;
					const destThumbPath = file.hasThumb ? `${uploadDirectory}/${destinationBoard}/file/thumb/${file.hash}${file.thumbextension}` : null;

					// Copy files if they exist
					if (sourceFilePath) {
						await ensureDir(`${uploadDirectory}/${destFileFolder}`);
						await copy(sourceFilePath, destFilePath);
						console.log(`Copied file from ${sourceFilePath} to ${destFilePath}`);
					}
					if (sourceThumbPath) {
						await ensureDir(`${uploadDirectory}/${destinationBoard}/file/thumb`);
						await copy(sourceThumbPath, destThumbPath);
						console.log(`Copied thumb from ${sourceThumbPath} to ${destThumbPath}`);
					}
				}
			}
		}
	}

	//emit markPost moves
	for (let i = 0; i < moveEmits.length; i++) {
		Socketio.emitRoom(moveEmits[i].room, 'markPost', { postId: moveEmits[i].postId, type: 'move' });
	}

	//no destination thread specified (making new thread from posts), need to fetch OP as destinationThread for remarkup/salt
	if (!res.locals.destinationThread) {
		res.locals.destinationThread = await Posts.getPost(destinationBoard, destinationThreadId);
	}

	//get posts that quoted moved posts so we can remarkup them
	if (backlinkRebuilds.size > 0) {
		const remarkupPosts = await Posts.globalGetPosts([...backlinkRebuilds]);
		await Promise.all(remarkupPosts.map(async post => { //doing these all at once
			const postUpdate = {};
			//update post message and/or id
			if (post.userId) {
				let userId = createHash('sha256').update(res.locals.destinationThread.salt + post.ip.raw).digest('hex');
				userId = userId.substring(userId.length-6);
				postUpdate.userId = userId;
			}
			if (post.nomarkup && post.nomarkup.length > 0) {
				const nomarkup = prepareMarkdown(post.nomarkup, false);
				const { message, quotes, crossquotes } = await messageHandler(nomarkup, post.board, post.thread, null);
				bulkWrites.push({
					'updateMany': {
						'filter': {
							'_id': {
								'$in': quotes.map(q => q._id)
							}
						},
						'update': {
							'$push': {
								'backlinks': { _id: post._id, postId: post.postId }
							}
						}
					}
				});
				postUpdate.quotes = quotes;
				postUpdate.crossquotes = crossquotes;
				postUpdate.message = message;
			}
			if (Object.keys(postUpdate).length > 0) {
				bulkWrites.push({
					'updateOne': {
						'filter': {
							'_id': post._id
						},
						'update': {
							'$set': postUpdate
						}
					}
				});
			}
		}));
	}

	//bulkwrite it all
	if (bulkWrites.length > 0) {
		await Posts.db.bulkWrite(bulkWrites);
	}

	//delete html/json for no longer existing threads, because op was moved
	if (threads.length > 0) {
		await Promise.all(threads.map(thread => {
			return Promise.all([
				remove(`${uploadDirectory}/html/${thread.board}/thread/${thread.postId}.html`),
				remove(`${uploadDirectory}/json/${thread.board}/thread/${thread.postId}.json`)
			]);
		}));
	}

	return {
		message: __('Moved posts'),
		action: movedPosts > 0,
	};

};
