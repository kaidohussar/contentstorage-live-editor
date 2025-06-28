import {
  COMMUNICATION_TIMEOUT_MS,
  INCOMING_MESSAGE_TYPES,
  OUTGOING_MESSAGE_TYPES,
} from './contants';
import { setAndApplyInitialConfig, setConfig } from './helpers/config';
import {
  hideContentstorageElementsHighlight,
  markContentStorageElements,
  showOriginalContent,
  showPendingChanges,
} from './helpers/markContentStorageElements';
import {
  mutationObserverCallback,
  mutationObserverConfig,
} from './helpers/mutationObserver';
import { sendMessageToParent } from './helpers/sendMessageToParent';
import { PendingChangeSimple } from './types';

(function () {
  const currentScript = document.currentScript as HTMLScriptElement;
  if (!currentScript) {
    console.error(
      "CDN Script: Could not determine the current script element. This is necessary to read URL parameters from the script's own URL. Ensure the script is loaded via a standard <script> tag."
    );
    return;
  }
  const scriptSrc = currentScript.src;
  console.log(`CDN Script: Loaded from ${scriptSrc}`);

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

  if (window.parent && window.parent !== window) {
    console.log(
      'CDN Script: Running inside an iframe. Setting up communication with parent and initiating handshake.'
    );

    // Create an observer instance linked to the callback function
    const observer = new MutationObserver(mutationObserverCallback);

    let handshakeSuccessful = false;
    let handshakeTimeoutId: number | undefined;

    // Handler for messages from the parent
    const messageFromParentHandler = (event: MessageEvent) => {
      // if (event.origin !== IFRAME_PARENT_ORIGIN) {
      //   console.warn("CDN Script: Received message from unexpected origin:", event.origin);
      //   return;
      // }

      if (event.source === window.parent && event.data) {
        if (event.data.type === INCOMING_MESSAGE_TYPES.HANDSHAKE_ACKNOWLEDGE) {
          if (!handshakeSuccessful) {
            // Process handshake ack only once
            handshakeSuccessful = true;

            console.log(
              'CDN Script: Received handshake acknowledgment from parent:',
              event.data.payload
            );

            setAndApplyInitialConfig(event.data.payload.data.config);
            console.log('Applied config:', event.data.payload);

            console.log('Started observing DOM for mutations');
            observer.observe(document.body, mutationObserverConfig);

            console.log(
              'CDN Script: Received handshake acknowledgment from parent:',
              event.data.payload
            );
            cleanupHandshakeResources();
            console.log(
              'CDN Script: Parent communication handshake successful. Ready for further messages.'
            );
            // Start
          }
        } else {
          // Handle other types of messages from the parent after handshake
          if (handshakeSuccessful) {
            console.log(
              'CDN Script: Received further message from parent:',
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
              event.data.type === INCOMING_MESSAGE_TYPES.SHOW_PENDING_CHANGES
            ) {
              showPendingChanges(
                event.data.payload.data as PendingChangeSimple[]
              );
            }

            if (
              event.data.type === INCOMING_MESSAGE_TYPES.SHOW_ORIGINAL_CONTENT
            ) {
              showOriginalContent();
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
      // window.removeEventListener("message", messageFromParentHandler); // Only remove if no further messages are expected
    };

    // Add listener for parent's response (for handshake and subsequent messages)
    window.addEventListener('message', messageFromParentHandler);

    sendMessageToParent(
      OUTGOING_MESSAGE_TYPES.HANDSHAKE_INITIATE,
      `Hello from iframe script (editor param: ${liveEditorParamValue}). Initiating handshake.`
    );

    // Timeout for the initial handshake
    handshakeTimeoutId = window.setTimeout(() => {
      if (!handshakeSuccessful) {
        console.warn(
          'CDN Script: Parent communication handshake timed out. Parent did not respond or acknowledge correctly.'
        );
        cleanupHandshakeResources(); // Clean up timeout
        // Still keep the general message listener in case parent responds late or for other messages,
        // or decide to remove it if handshake is strictly required to proceed.
        // document.body.innerHTML = `<p style="color:red;">Error: Could not establish initial communication with the parent application (handshake timeout).</p>`;
      }
    }, COMMUNICATION_TIMEOUT_MS);
  } else {
    console.log(
      'CDN Script: Not running inside an iframe, or parent is not accessible. Skipping parent communication setup.'
    );
  }
})();
