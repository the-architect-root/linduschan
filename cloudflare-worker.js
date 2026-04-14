// Cloudflare Worker for induschan.site
// This worker handles dynamic routes and proxies to the backend

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Handle static files - serve from Cloudflare Pages
    if (url.pathname.startsWith('/static/') || 
        url.pathname.endsWith('.css') || 
        url.pathname.endsWith('.js') ||
        url.pathname.endsWith('.png') ||
        url.pathname.endsWith('.jpg') ||
        url.pathname.endsWith('.gif') ||
        url.pathname.endsWith('.svg') ||
        url.pathname.endsWith('.ico')) {
      // Let Cloudflare Pages handle static assets
      return fetch(request);
    }

    // Handle dynamic routes - proxy to backend
    // Note: For a full implementation, you would need to deploy the Node.js backend
    // separately and proxy requests to it. This is a simplified example.
    
    // For now, return a message indicating backend needs to be deployed
    if (url.pathname === '/api' || url.pathname.startsWith('/forms/')) {
      return new Response('Backend API not yet deployed. Please deploy the Node.js backend.', {
        status: 503,
        headers: {
          'Content-Type': 'text/plain',
        },
      });
    }

    // For other routes, try to fetch from Cloudflare Pages
    return fetch(request);
  },
};
