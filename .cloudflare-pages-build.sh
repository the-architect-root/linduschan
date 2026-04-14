#!/bin/bash

# Cloudflare Pages build script for induschan.site

# Install dependencies
npm install

# Build static files
npm run build

# Note: Cloudflare Pages will serve the static files from the 'static/' directory
# The dynamic backend needs to be deployed separately (e.g., to Cloudflare Workers or another platform)
