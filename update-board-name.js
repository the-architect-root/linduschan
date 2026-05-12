'use strict';

/**
 * Script to update a board's display name
 * Usage: node update-board-name.js <boardUri> <newName>
 * Example: node update-board-name.js kama "Kama"
 */

const { MongoClient } = require('mongodb');

const boardUri = process.argv[2];
const newName = process.argv[3];

if (!boardUri || !newName) {
	console.error('Usage: node update-board-name.js <boardUri> <newName>');
	console.error('Example: node update-board-name.js kama "Kama"');
	process.exit(1);
}

const MONGO_URL = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/jschan';

async function updateBoardName() {
	const client = new MongoClient(MONGO_URL);
	
	try {
		await client.connect();
		console.log('Connected to MongoDB');
		
		const db = client.db();
		
		// Check if board exists
		const board = await db.collection('boards').findOne({ _id: boardUri });
		if (!board) {
			console.error(`Error: Board "${boardUri}" does not exist`);
			process.exit(1);
		}
		
		const oldName = board.settings?.name || board.name || boardUri;
		console.log(`Current board name: ${oldName}`);
		
		// Update the board name in settings
		const result = await db.collection('boards').updateOne(
			{ _id: boardUri },
			{ $set: { 'settings.name': newName } }
		);
		
		if (result.modifiedCount === 1) {
			console.log(`✅ Board name updated: "${oldName}" → "${newName}"`);
		} else {
			console.log('No changes made (name may already be set to the new value)');
		}
		
		console.log('\nNext steps:');
		console.log('1. Clear Redis cache: redis-cli flushdb');
		console.log('2. The new name will appear after cache refresh');
		
	} catch (err) {
		console.error('Error:', err);
		process.exit(1);
	} finally {
		await client.close();
	}
}

updateBoardName();
