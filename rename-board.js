'use strict';

/**
 * Script to rename a board from oldName to newName
 * Usage: node rename-board.js <oldName> <newName>
 * Example: node rename-board.js gama kama
 */

const { MongoClient, ObjectId } = require('mongodb');
const { renameSync, existsSync } = require('fs');
const path = require('path');

const uploadDirectory = '/home/alt/jschan/static/file';

// Get command line arguments
const oldName = process.argv[2];
const newName = process.argv[3];

if (!oldName || !newName) {
	console.error('Usage: node rename-board.js <oldName> <newName>');
	console.error('Example: node rename-board.js gama kama');
	process.exit(1);
}

if (!/^[a-zA-Z0-9_-]+$/.test(newName)) {
	console.error('Error: New board name must contain only letters, numbers, hyphens, and underscores');
	process.exit(1);
}

const MONGO_URL = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/jschan';

async function renameBoard() {
	const client = new MongoClient(MONGO_URL);
	
	try {
		await client.connect();
		console.log('Connected to MongoDB');
		
		const db = client.db();
		
		// 1. Check if old board exists
		const oldBoard = await db.collection('boards').findOne({ _id: oldName });
		if (!oldBoard) {
			console.error(`Error: Board "${oldName}" does not exist`);
			process.exit(1);
		}
		console.log(`Found board: ${oldName}`);
		
		// 2. Check if new board name is already taken
		const newBoardExists = await db.collection('boards').findOne({ _id: newName });
		if (newBoardExists) {
			console.error(`Error: Board "${newName}" already exists`);
			process.exit(1);
		}
		
		// 3. Create new board document with new _id
		const newBoardDoc = { ...oldBoard, _id: newName };
		await db.collection('boards').insertOne(newBoardDoc);
		console.log(`Created new board document: ${newName}`);
		
		// 4. Update all posts
		const postsResult = await db.collection('posts').updateMany(
			{ board: oldName },
			{ $set: { board: newName } }
		);
		console.log(`Updated ${postsResult.modifiedCount} posts`);
		
		// 5. Update accounts (staff references)
		const accountsResult = await db.collection('accounts').updateMany(
			{ [`staff.${oldName}`]: { $exists: true } },
			{ $rename: { [`staff.${oldName}`]: `staff.${newName}` } }
		);
		console.log(`Updated ${accountsResult.modifiedCount} accounts`);
		
		// 6. Update bans
		const bansResult = await db.collection('bans').updateMany(
			{ board: oldName },
			{ $set: { board: newName } }
		);
		console.log(`Updated ${bansResult.modifiedCount} bans`);
		
		// 7. Update filters
		const filtersResult = await db.collection('filters').updateMany(
			{ board: oldName },
			{ $set: { board: newName } }
		);
		console.log(`Updated ${filtersResult.modifiedCount} filters`);
		
		// 8. Update custom pages
		const customPagesResult = await db.collection('custompages').updateMany(
			{ board: oldName },
			{ $set: { board: newName } }
		);
		console.log(`Updated ${customPagesResult.modifiedCount} custom pages`);
		
		// 9. Update stats
		const statsResult = await db.collection('stats').updateMany(
			{ board: oldName },
			{ $set: { board: newName } }
		);
		console.log(`Updated ${statsResult.modifiedCount} stats`);
		
		// 10. Update modlogs
		const modlogsResult = await db.collection('modlogs').updateMany(
			{ board: oldName },
			{ $set: { board: newName } }
		);
		console.log(`Updated ${modlogsResult.modifiedCount} mod logs`);
		
		// 11. Rename file directories (banners, assets, flags)
		const dirsToRename = ['banner', 'asset', 'flag'];
		for (const dir of dirsToRename) {
			const oldDir = path.join(uploadDirectory, dir, oldName);
			const newDir = path.join(uploadDirectory, dir, newName);
			if (existsSync(oldDir)) {
				try {
					renameSync(oldDir, newDir);
					console.log(`Renamed ${dir} directory: ${oldName} -> ${newName}`);
				} catch (err) {
					console.warn(`Warning: Could not rename ${dir} directory: ${err.message}`);
				}
			}
		}
		
		// 12. Delete old board document
		await db.collection('boards').deleteOne({ _id: oldName });
		console.log(`Deleted old board document: ${oldName}`);
		
		console.log('\n✅ Board renamed successfully!');
		console.log(`\nNext steps:`);
		console.log(`1. Clear Redis cache: redis-cli flushdb (or restart Redis)`);
		console.log(`2. Restart JSChan server`);
		console.log(`3. Update any hardcoded links to /${oldName}/ to /${newName}/`);
		
	} catch (err) {
		console.error('Error:', err);
		process.exit(1);
	} finally {
		await client.close();
	}
}

renameBoard();
