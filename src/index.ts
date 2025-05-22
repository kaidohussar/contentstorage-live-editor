(function() {
  const scriptTag = document.currentScript;
  if (!scriptTag) {
    console.error("Live Editor: Could not find the script tag. Ensure this script is not loaded with `defer` in a way that prevents `document.currentScript` access during initial execution.");
    return;
  }

  const appKey = scriptTag.dataset.appKey;

  if (appKey) {
    console.log("Live Editor initialized with Application Key:", appKey);
    // --- Your script's logic using appKey ---
    // Example: initializeYourEditor(appKey);
    // -----------------------------------------
  } else {
    console.error("Live Editor: Application key is missing. Please add the 'data-app-key' attribute to the script tag.");
  }
})();
