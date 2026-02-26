import {
  COMMUNICATION_TIMEOUT_MS,
  INCOMING_MESSAGE_TYPES,
  IncomingMessagePayloadMap,
  OUTGOING_MESSAGE_TYPES,
} from './contants';
import { setAndApplyInitialConfig, setConfig } from './helpers/config';
import {
  hideContentstorageElementsHighlight,
  hideElementHighlight,
  markContentStorageElements,
  showElementHighlight,
  showOriginalContent,
  showPendingChanges,
} from './helpers/markContentStorageElements';
import {
  mutationObserverCallback,
  mutationObserverConfig,
  processDomChanges,
  refreshHighlighting,
  setObserverInstance,
  pauseObserver,
} from './helpers/mutationObserver';
import { sendMessageToParent, setParentWindowRef } from './helpers/sendMessageToParent';
import { PendingChangeSimple } from './types';
import { clearPendingChanges, setPendingChanges } from './helpers/misc';
import { handleScreenshotRequest } from './helpers/screenshot';
import { isScreenshotModeEnabled, isPipMode, isPipModeReconnection } from './helpers/urlParams';
import { createCameraButton } from './helpers/screenshotMode';
import { initAgentAPI } from './agent-api';

(function () {
  const currentScript = document.currentScript as HTMLScriptElement;
  if (!currentScript) {
    console.error(
      "CDN Script: Could not determine the current script element. This is necessary to read URL parameters from the script's own URL. Ensure the script is loaded via a standard <script> tag."
    );
    return;
  }
  const scriptSrc = currentScript.src;
  console.log(`[Live editor] CDN Script loaded from ${scriptSrc}`);

  // --- 2. Check for 'contentstorage-live-editor' URL Parameter ---
  let liveEditorParamValue: string | null = null;
  try {
    const url = new URL(scriptSrc);
    liveEditorParamValue = url.searchParams.get('contentstorage-live-editor');
  } catch (e) {
    console.error(
      "CDN Script: Could not parse script URL. Ensure it's a valid URL.",
      e
    );
    return;
  }

  if (!liveEditorParamValue) {
    console.warn(
      "CDN Script: The 'contentstorage-live-editor' URL parameter is MISSING in the script's src. This is a prerequisite. Halting further iframe-specific operations."
    );
    // You might want to display a message in the iframe or simply stop execution
    // For example, document.body.innerHTML = "<p>Error: Configuration parameter missing.</p>";
    return;
  }

  const isInIframe = window.parent && window.parent !== window;
  const isInPipMode = isPipMode() && window.opener && window.opener !== window;
  // Detect if we need reconnection: pip_mode flag is set but window.opener is gone (after refresh/OAuth)
  const needsReconnection = isPipMode() && (!window.opener || window.opener === window);
  const isStandaloneScreenshotMode = !isInIframe && !isInPipMode && !needsReconnection && isScreenshotModeEnabled();

  // Agent mode: Playwright/Puppeteer injects script for translation agent
  const isAgentMode = (() => {
    try {
      const url = new URL(scriptSrc);
      return url.searchParams.get('agent-mode') === 'true';
    } catch {
      return false;
    }
  })();

  if (isInIframe || isInPipMode || needsReconnection || isStandaloneScreenshotMode) {
    const isReconnection = isPipModeReconnection() || needsReconnection;
    console.log(
      isInIframe
        ? '[Live editor] Running inside an iframe. Setting up communication with parent and initiating handshake.'
        : isInPipMode
        ? `[Live editor] Running in PiP mode (opened via window.open)${isReconnection ? ' - RECONNECTING after navigation/OAuth' : ''}. Setting up communication with opener.`
        : needsReconnection
        ? '[Live editor] Running in PiP mode - NEEDS RECONNECTION (window.opener lost after refresh). Waiting for parent ping.'
        : '[Live editor] Running in standalone screenshot mode.'
    );

    // Create an observer instance linked to the callback function
    const observer = new MutationObserver(mutationObserverCallback);

    if (isStandaloneScreenshotMode) {
      // Standalone screenshot mode - initialize directly without handshake
      setAndApplyInitialConfig({
        highlightEditableContent: true,
        showPendingChanges: false,
      });

      processDomChanges();

      console.log('[Live editor] Started observing DOM for mutations');
      observer.observe(document.body, mutationObserverConfig);
      setObserverInstance(observer);

      // Add camera button for taking screenshots
      createCameraButton();

      console.log('[Live editor] Standalone screenshot mode ready');
    } else {
      // Iframe/PiP mode - setup handshake with parent/opener
      let handshakeSuccessful = false;
      let handshakeTimeoutId: number | undefined;
      let visibilityListenerSetup = false;

      // Determine expected message source based on mode (mutable for reconnection)
      let expectedSource: Window | null = isInPipMode ? window.opener : window.parent;

      // Setup visibility change listener for PiP mode
      const setupVisibilityListener = () => {
        if (visibilityListenerSetup) return;
        visibilityListenerSetup = true;

        // Send initial visibility state
        sendMessageToParent(OUTGOING_MESSAGE_TYPES.VISIBILITY_CHANGE, {
          isVisible: document.visibilityState === 'visible',
        });

        // Listen for visibility changes
        document.addEventListener('visibilitychange', () => {
          const isVisible = document.visibilityState === 'visible';
          console.log('[Live editor] Visibility changed:', isVisible);
          sendMessageToParent(OUTGOING_MESSAGE_TYPES.VISIBILITY_CHANGE, {
            isVisible,
          });
        });
      };

      // Handler for messages from the parent/opener
      const messageFromParentHandler = (event: MessageEvent) => {
        // Handle RECONNECT_PING - only respond if handshake not yet successful
        // This allows parent to re-establish connection after child refresh
        if (event.data?.type === INCOMING_MESSAGE_TYPES.RECONNECT_PING) {
          if (!handshakeSuccessful && event.source && event.source !== window) {
            console.log('[Live editor] Received RECONNECT_PING, responding (handshake not complete)');
            // Update expected source reference from event.source
            expectedSource = event.source as Window;
            setParentWindowRef(event.source as Window);
            // Send RECONNECT_PONG back to parent
            sendMessageToParent(OUTGOING_MESSAGE_TYPES.RECONNECT_PONG, null);
          }
          // Ignore RECONNECT_PING if handshake already successful
          return;
        }

        if (event.source === expectedSource && event.data) {
          if (
            event.data.type === INCOMING_MESSAGE_TYPES.HANDSHAKE_ACKNOWLEDGE
          ) {
            if (!handshakeSuccessful) {
              // Process handshake ack only once
              handshakeSuccessful = true;

              console.log(
                '[Live editor] Received handshake acknowledgment from parent:',
                event.data.payload
              );

              setAndApplyInitialConfig(event.data.payload.data.config);
              console.log('[Live editor] Applied config:', event.data.payload);

              // In standalone mode (browser script without SDK), skip auto-sending content nodes
              // Wait for translations or AI analysis to provide content keys via SET_CONTENT_KEYS message
              if (window.isStandaloneMode) {
                console.log(
                  '[Live editor] Standalone mode detected - skipping auto content detection. Waiting for translations or SET_CONTENT_KEYS.'
                );

                // Register refresh callback so browser-script can trigger re-scan
                // after receiving translations via postMessage
                window.__contentstorageRefresh = () => {
                  const foundNodes = refreshHighlighting();
                  sendMessageToParent(OUTGOING_MESSAGE_TYPES.FOUND_CONTENT_NODES, {
                    contentNodes: foundNodes,
                    language: window.currentLanguageCode || null,
                  });
                };
              } else {
                // SDK mode - auto-detect and send content nodes
                processDomChanges();
              }

              console.log('[Live editor] Started observing DOM for mutations');
              observer.observe(document.body, mutationObserverConfig);
              setObserverInstance(observer);

              cleanupHandshakeResources();
              console.log(
                '[Live editor] Parent communication handshake successful. Ready for further messages.'
              );

              // In PiP mode (including reconnection), send visibility change events
              if (isInPipMode || needsReconnection) {
                setupVisibilityListener();
              }
            }
          } else {
            // Handle other types of messages from the parent after handshake
            if (handshakeSuccessful) {
              console.log(
                '[Live editor] Received further message from parent:',
                event.data
              );

              if (event.data.type === INCOMING_MESSAGE_TYPES.SET_CONFIG) {
                setConfig(event.data.payload.data);
              }

              if (
                event.data.type === INCOMING_MESSAGE_TYPES.SET_HIGHLIGHT_CONTENT
              ) {
                setConfig({ highlightEditableContent: true });
                markContentStorageElements([], true);
              }

              if (
                event.data.type ===
                INCOMING_MESSAGE_TYPES.SET_HIDE_HIGHLIGHT_CONTENT
              ) {
                setConfig({ highlightEditableContent: false });
                hideContentstorageElementsHighlight();
              }

              if (
                event.data.type === INCOMING_MESSAGE_TYPES.HIDE_ELEMENT_HIGHLIGHT
              ) {
                const { contentKey } = event.data.payload.data as {
                  contentKey: string;
                };
                hideElementHighlight(contentKey);
              }

              if (
                event.data.type === INCOMING_MESSAGE_TYPES.SHOW_ELEMENT_HIGHLIGHT
              ) {
                const { contentKey } = event.data.payload.data as {
                  contentKey: string;
                };
                showElementHighlight(contentKey);
              }

              if (
                event.data.type === INCOMING_MESSAGE_TYPES.SHOW_PENDING_CHANGES
              ) {
                const pendingChangesData = event.data.payload
                  .data as PendingChangeSimple[];
                setPendingChanges(pendingChangesData);
                setConfig({ showPendingChanges: true });
                showPendingChanges(pendingChangesData);
              }

              if (
                event.data.type === INCOMING_MESSAGE_TYPES.SHOW_ORIGINAL_CONTENT
              ) {
                showOriginalContent();
                clearPendingChanges();
                setConfig({ showPendingChanges: false });
              }

              if (
                event.data.type === INCOMING_MESSAGE_TYPES.REQUEST_SCREENSHOT
              ) {
                handleScreenshotRequest(event.data.payload?.data?.quality, event.data.payload?.data?.maxWidth);
              }

              if (
                event.data.type === INCOMING_MESSAGE_TYPES.SET_CONTENT_KEYS
              ) {
                const { matches } = event.data.payload
                  .data as IncomingMessagePayloadMap[typeof INCOMING_MESSAGE_TYPES.SET_CONTENT_KEYS];

                // Populate memoryMap with matched keys from parent
                for (const match of matches) {
                  if (match.contentKey) {
                    const existing = window.memoryMap.get(match.text);
                    if (existing) {
                      existing.ids.add(match.contentKey);
                    } else {
                      window.memoryMap.set(match.text, {
                        ids: new Set([match.contentKey]),
                        type: 'text',
                      });
                    }
                  }
                }

                // Refresh highlighting and get found nodes
                const foundNodes = refreshHighlighting();

                // Send found content nodes to parent so panel shows only visible keys
                sendMessageToParent(OUTGOING_MESSAGE_TYPES.FOUND_CONTENT_NODES, {
                  contentNodes: foundNodes,
                  language: null,
                });
              }

              // Process other messages here
            } else {
              console.warn(
                'CDN Script: Received message from parent before handshake was complete. Ignoring:',
                event.data
              );
            }
          }
        }
      };

      const cleanupHandshakeResources = () => {
        if (handshakeTimeoutId) {
          clearTimeout(handshakeTimeoutId);
          handshakeTimeoutId = undefined;
        }
        // We keep the general message listener active for further communication
      };

      // Add listener for parent's response (for handshake and subsequent messages)
      window.addEventListener('message', messageFromParentHandler);

      // In reconnection mode, don't send handshake - wait for RECONNECT_PING instead
      if (needsReconnection) {
        console.log('[Live editor] Waiting for RECONNECT_PING from parent...');
      } else {
        sendMessageToParent(
          OUTGOING_MESSAGE_TYPES.HANDSHAKE_INITIATE,
          {
            message: `Hello from iframe script (editor param: ${liveEditorParamValue}). Initiating handshake.`,
            isStandalone: window.isStandaloneMode ?? false,
          }
        );

        // Timeout for the initial handshake (not needed for reconnection mode)
        handshakeTimeoutId = window.setTimeout(() => {
          if (!handshakeSuccessful) {
            console.warn(
              'CDN Script: Parent communication handshake timed out. Parent did not respond or acknowledge correctly.'
            );
            cleanupHandshakeResources();
          }
        }, COMMUNICATION_TIMEOUT_MS);
      }
    }
  } else if (isAgentMode) {
    console.log('[Live editor] Running in agent mode.');

    // Initialize memoryMap if not present
    if (!window.memoryMap) {
      window.memoryMap = new Map();
    }
    if (typeof window.currentLanguageCode === 'undefined') {
      window.currentLanguageCode = null;
    }

    // Highlighting OFF by default — agent controls via enableHighlighting()/disableHighlighting()
    setAndApplyInitialConfig({
      highlightEditableContent: false,
      showPendingChanges: false,
      showEditButton: false,
    });

    // Set up MutationObserver but immediately pause — agent controls via API
    const observer = new MutationObserver(mutationObserverCallback);
    observer.observe(document.body, mutationObserverConfig);
    setObserverInstance(observer);
    pauseObserver();

    // Expose agent API
    initAgentAPI();

    console.log('[Live editor] Agent mode ready. API available at window.__contentstorageAgentAPI');
  } else {
    console.log(
      '[Live editor] Not running inside an iframe or PiP mode, or opener/parent is not accessible. Skipping parent communication setup.'
    );
  }
})();
