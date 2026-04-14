'use strict';

const { debugLogs } = require(__dirname+'/../../configs/secrets.js');

let fontList = [];
try {
	fontList = require('child_process')
		.execSync('fc-list -f "%{file}:%{family[0]} %{style[0]}\n" 2>/dev/null || echo ""')
		.toString()
		.split('\n') //split by newlines, like here ^
		.filter(line => line) //filter empty lines
		.map(line => {
			//map to an object with path and name
			const [path, name] = line.split(':');
			return { path, name };
		})
		.sort((a, b) => {
			//alphabetical name sort
			return a.name.localeCompare(b.name);
		});
} catch (e) {
	// fc-list not available (e.g. in Vercel/serverless)
	debugLogs && console.log('fc-list not available, using empty font list');
}

debugLogs && console.log(`${fontList.length} system fonts available`);

module.exports = {
	fontList,
	fontPaths: new Set(['default', ...fontList.map(f => f.path)]), //memoize paths
	DejaVuSans: fontList.find(f => f.name === 'DejaVu Sans Book'), //default for grid captchas
};
