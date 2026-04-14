'use strict';

const Mongo = require(__dirname+'/db/db.js')
	, bcrypt = require('bcrypt')
	, Permission = require(__dirname+'/lib/permission/permission.js')
	, { Binary } = require('mongodb');

(async () => {
	await Mongo.connect();
	await Mongo.checkVersion();
	
	// Create ROOT permissions
	const ROOT = new Permission();
	ROOT.set(0, true); // Set ROOT permission (bit 0)
	ROOT.applyInheritance(); // Apply inheritance to get all permissions
	
	// Hash password
	const passwordHash = await bcrypt.hash('alterego666', 12);
	
	// Insert admin account directly
	const result = await Mongo.db.collection('accounts').insertOne({
		'_id': 'admin',
		'original': 'admin',
		'passwordHash': passwordHash,
		'permissions': Binary(ROOT.array),
		'ownedBoards': [],
		'staffBoards': [],
		'twofactor': null,
		'web3': false
	});
	
	console.log('Admin account created with password: alterego666');
	process.exit(0);
})();
