/**
 * www.carlosluengo.com -> https://carlosluengo.com, keeping path and query.
 *
 * The old GitHub Pages blog (carluve.github.io) redirects every URL to www,
 * so this keeps those links alive. Old Jekyll paths are then resolved by the
 * main site's _redirects. A trailing slash is dropped here to save a hop.
 */
export default {
  fetch(request: Request): Response {
    const url = new URL(request.url);
    const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : '/';
    return new Response(null, {
      status: 301,
      headers: {
        Location: `https://carlosluengo.com${path}${url.search}`,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  },
};
