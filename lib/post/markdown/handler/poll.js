'use strict';

module.exports = {

	regexPrepare: /\[poll\]([\s\S]*?)\[\/poll\]/gmi,
	regexMarkdown: /\[POLL:([^:]+):([^:]+):(.+)\]/gmi,

	prepare: (force, match, content) => {
		// Parse poll content: first line is question, rest are options
		const lines = content.trim().split('\n').map(l => l.trim()).filter(l => l.length > 0);
		if (lines.length < 3) {
			return match; // Need at least question + 2 options
		}

		const question = lines[0];
		const options = lines.slice(1);

		// Store poll data temporarily with placeholder for board/post
		// Format: [POLL:BOARD:POSTID:question:options...]
		return `[POLL:BOARD:POSTID:${question}:${options.join('|')}]`;
	},

	markdown: (permissions, match, board, postId, rest) => {
		// rest contains "question:option1|option2|option3..."
		if (!rest || typeof rest !== 'string') {
			return match; // Invalid format, return original
		}

		// Split rest into question and options
		const firstColonIndex = rest.indexOf(':');
		if (firstColonIndex === -1) {
			return match; // No colon found, invalid format
		}

		const question = rest.substring(0, firstColonIndex);
		const optionsStr = rest.substring(firstColonIndex + 1);
		const options = optionsStr.split('|');

		// Generate poll HTML using postId as poll identifier
		let html = `<div class="post-poll" data-poll-id="${postId}" data-board="${board}" data-post-id="${postId}">`;
		html += `<h4>${question}</h4>`;
		html += `<div class="poll-options">`;

		options.forEach((opt, idx) => {
			html += `<label class="poll-option">`;
			html += `<input type="radio" name="poll-${postId}" value="${idx}">`;
			html += `<span>${opt}</span>`;
			html += `</label>`;
		});

		html += `</div>`;
		html += `<button class="poll-vote-btn" onclick="submitPollVote('${board}', '${postId}', document.querySelector('input[name=poll-${postId}]:checked')?.value)">Vote</button>`;
		html += `<div class="poll-results" style="display:none;"></div>`;
		html += `</div>`;

		return html;
	}

};
