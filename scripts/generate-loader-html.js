import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const distDir = join(__dirname, '..', 'dist');

// Readable version of the loader snippet (for HTML output)
const readableSnippet = `(function () {
  var isInIframe = window.parent && window.parent !== window;
  var isInPipMode = window.opener && window.opener !== window;
  var hasParam = new URLSearchParams(window.location.search)
    .get('contentstorage_live_editor') === 'true';

  if ((isInIframe || isInPipMode) && hasParam) {
    var script = document.createElement('script');
    script.src = 'https://cdn.contentstorage.app/browser-script.js';
    script.async = true;
    document.head.appendChild(script);
  }
})();`;

// Generate HTML snippet ready for copy-paste
const htmlSnippet = `<!-- Contentstorage Live Editor Loader -->
<script>
${readableSnippet}
</script>
`;

// Write to dist folder
writeFileSync(join(distDir, 'loader-snippet.html'), htmlSnippet);

console.log('✓ Generated dist/loader-snippet.html');
console.log('\nCopy and paste this into your <head> tag:\n');
console.log(htmlSnippet);
