module.exports = {

	//mongodb connection string
		dbURL: 'mongodb+srv://sarthak_db_user:alterego666@ascendchan.efna1br.mongodb.net/jschan?retryWrites=true&w=majority&appName=AscendChan',

	//database name
	dbName: 'jschan',

	//redis connection info
	redis: {
		host: 'redis-16938.c264.ap-south-1-1.ec2.cloud.redislabs.com',
		port: '16938',
		password: 'FTqTiKqkJklWzIeX2jSqS1U6Ny0yXgnv'
	},

	//backend webserver port
	port: 7000,

	//secrets/salts for various things
	cookieSecret: 'alterego666',
	tripcodeSecret: 'alterego666',
	ipHashSecret: 'alterego666',
	postPasswordSecret: 'alterego666',

	//keys for google recaptcha
	google: {
		siteKey: 'changeme',
		secretKey: 'changeme'
	},

	//keys for hcaptcha
	hcaptcha: {
		siteKey: '10000000-ffff-ffff-ffff-000000000001',
		secretKey: '0x0000000000000000000000000000000000000000'
	},

	//keys for yandex smartcaptcha
	yandex: {
		siteKey: 'changeme',
		secretKey: 'changeme'
	},

	//Cloudflare R2 storage configuration
	r2: {
		accountId: '0dd5e157de32e810ca24f27d1f98b548',
		accessKeyId: '501a616238e4b515a03dc16795925e39',
		secretAccessKey: 'f34591aa5192d990742d8d56e068a997964ee3edb734d476d5183a045018b2a9',
		bucketName: 'induschan-files',
		region: 'auto',
		endpoint: 'https://0dd5e157de32e810ca24f27d1f98b548.r2.cloudflarestorage.com',
		publicUrl: 'https://induschan-files.r2.dev' // e.g., https://your-bucket.r2.dev
	},

	//enable debug logging
	debugLogs: false,

};
