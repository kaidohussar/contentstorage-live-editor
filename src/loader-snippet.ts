/**
 * Lightweight loader snippet for user's <head> tag
 * Only loads the full browser script when in iframe/PiP mode with live editor param
 *
 * User adds this minified snippet to their website's <head>:
 * The build process outputs a minified version to dist/loader-snippet.js
 */
(function () {
  const isInIframe = window.parent && window.parent !== window;
  const isInPipMode = window.opener && window.opener !== window;
  const hasLiveEditorParam =
    new URLSearchParams(window.location.search).get('contentstorage_live_editor') === 'true';

  if ((isInIframe || isInPipMode) && hasLiveEditorParam) {
    const script = document.createElement('script');
    script.src = 'https://cdn.contentstorage.app/browser-script.js';
    script.async = true;
    document.head.appendChild(script);
  }
})();