'use strict';

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

let r2Client = null;

// Initialize R2 client
function initR2() {
	if (r2Client) return r2Client;

	// Prioritize environment variables (for Render)
	let r2Config = {
		accountId: process.env.R2_ACCOUNT_ID,
		accessKeyId: process.env.R2_ACCESS_KEY_ID,
		secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
		bucketName: process.env.R2_BUCKET_NAME,
		region: process.env.R2_REGION || 'auto',
		endpoint: process.env.R2_ENDPOINT,
		publicUrl: process.env.R2_PUBLIC_URL
	};

	// Fallback to secrets.js if env vars not set
	if (!r2Config.accessKeyId) {
		try {
			const secrets = require(__dirname+'/../../configs/secrets.js');
			r2Config = secrets.r2;
		} catch (e) {
			console.warn('R2 not configured in env vars or secrets.js');
		}
	}

	if (!r2Config || !r2Config.accessKeyId || !r2Config.secretAccessKey) {
		console.warn('R2 not configured, using local storage');
		return null;
	}

	console.log('R2 Configuration:', {
		endpoint: r2Config.endpoint,
		bucketName: r2Config.bucketName,
		publicUrl: r2Config.publicUrl,
	});

	r2Client = new S3Client({
		endpoint: r2Config.endpoint,
		credentials: {
			accessKeyId: r2Config.accessKeyId,
			secretAccessKey: r2Config.secretAccessKey,
		},
		forcePathStyle: true, // Required for R2
		region: 'us-east-1', // Required by AWS SDK but not used with custom endpoint
	});

	return r2Client;
}

function getR2Config() {
	// Prioritize environment variables
	if (process.env.R2_BUCKET_NAME && process.env.R2_PUBLIC_URL) {
		return {
			bucketName: process.env.R2_BUCKET_NAME,
			publicUrl: process.env.R2_PUBLIC_URL
		};
	}
	// Fallback to secrets.js
	try {
		const secrets = require(__dirname+'/../../configs/secrets.js');
		return secrets.r2;
	} catch (e) {
		return {
			bucketName: process.env.R2_BUCKET_NAME,
			publicUrl: process.env.R2_PUBLIC_URL
		};
	}
}

module.exports = async (file, filename, folder) => {
	const client = initR2();
	if (!client) {
		// R2 not configured, fall back to local storage
		const moveUpload = require(__dirname+'/moveupload.js');
		return moveUpload(file, filename, folder);
	}

	const r2Config = getR2Config();
	const key = `${folder}/${filename}`;

	try {
		// Read file from temp path
		const fs = require('fs-extra');
		const uploadDirectory = require(__dirname+'/uploaddirectory.js');
		const filePath = file.tempFilePath || `${uploadDirectory}/${folder}/${filename}`;
		const fileStream = fs.createReadStream(filePath);

		const command = new PutObjectCommand({
			Bucket: r2Config.bucketName,
			Key: key,
			Body: fileStream,
			ContentType: file.mimetype,
		});

		await client.send(command);
		return;
	} catch (err) {
		console.error('R2 upload failed, falling back to local storage:', err);
		// Fall back to local storage
		const moveUpload = require(__dirname+'/moveupload.js');
		return moveUpload(file, filename, folder);
	}
};

module.exports.getPublicUrl = (filename, folder) => {
	const r2Config = getR2Config();
	if (!r2Config || !r2Config.publicUrl) {
		// R2 not configured, use local path
		return `/${folder}/${filename}`;
	}
	return `${r2Config.publicUrl}/${folder}/${filename}`;
};

module.exports.isConfigured = () => {
	const client = initR2();
	return client !== null;
};

module.exports.getFileUrl = (filename, folder = 'file') => {
	const r2Config = getR2Config();
	if (!r2Config || !r2Config.publicUrl) {
		// R2 not configured, use local path
		return `/${folder}/${filename}`;
	}
	return `${r2Config.publicUrl}/${folder}/${filename}`;
};
