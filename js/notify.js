/**
 * Custom Notification Framework (Notify)
 * Replaces generic browser alert() with beautiful, non-blocking UI components.
 */

window.Notify = (function() {
  
  // 1. Toast Container setup
  let toastContainer = document.getElementById('notify-toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'notify-toast-container';
    document.body.appendChild(toastContainer);
  }

  // 2. Ticker Container setup
  let tickerContainer = document.getElementById('notify-ticker-container');
  let tickerTrack = null;
  if (!tickerContainer) {
    tickerContainer = document.createElement('div');
    tickerContainer.id = 'notify-ticker-container';
    tickerContainer.style.display = 'none'; // hidden by default
    
    tickerTrack = document.createElement('div');
    tickerTrack.className = 'notify-ticker-track';
    tickerContainer.appendChild(tickerTrack);
    document.body.appendChild(tickerContainer);
  } else {
    tickerTrack = tickerContainer.querySelector('.notify-ticker-track');
  }

  // 3. Popup Modal setup
  let popupOverlay = document.getElementById('notify-popup-overlay');
  let popupBox, popupTitle, popupMessage, popupBtnWrapper, popupBtnClose;
  if (!popupOverlay) {
    popupOverlay = document.createElement('div');
    popupOverlay.id = 'notify-popup-overlay';
    
    popupBox = document.createElement('div');
    popupBox.className = 'notify-popup';
    
    popupTitle = document.createElement('h3');
    popupMessage = document.createElement('p');
    
    popupBtnWrapper = document.createElement('div');
    popupBtnClose = document.createElement('button');
    popupBtnClose.className = 'btn btn-mint w-100';
    popupBtnClose.innerText = 'OK';
    popupBtnClose.addEventListener('click', () => {
      popupOverlay.classList.remove('show');
    });
    popupBtnWrapper.appendChild(popupBtnClose);
    
    popupBox.appendChild(popupTitle);
    popupBox.appendChild(popupMessage);
    popupBox.appendChild(popupBtnWrapper);
    popupOverlay.appendChild(popupBox);
    document.body.appendChild(popupOverlay);
  }

  return {
    /**
     * Shows a bottom-right floating toast.
     * @param {string} msg 
     * @param {number} duration ms
     */
    toast: function(msg, duration = 3000) {
      const el = document.createElement('div');
      el.className = 'notify-toast';
      el.innerText = msg;
      toastContainer.appendChild(el);
      
      // trigger reflow for animation
      void el.offsetWidth;
      el.classList.add('show');
      
      setTimeout(() => {
        el.classList.remove('show');
        setTimeout(() => {
          if(el.parentElement === toastContainer) toastContainer.removeChild(el);
        }, 300); // Wait for transition
      }, duration);
    },
    
    /**
     * Appends text to the persistent, scrolling bottom ticker.
     * @param {string} msg 
     */
    ticker: function(msg) {
      tickerContainer.style.display = 'block';
      const separator = tickerTrack.innerText ? '  •••  ' : '';
      tickerTrack.innerText += separator + msg;
      
      // Auto-hide ticker after a long time of no new messages (optional)
      clearTimeout(this._tickerTimeout);
      this._tickerTimeout = setTimeout(() => {
        tickerContainer.style.display = 'none';
        tickerTrack.innerText = '';
      }, 15000); // 15 seconds to finish scrolling
    },
    
    /**
     * Display a center popup modal.
     * @param {Object} options { title: string, message: string, autoCloseMs: number, showCloseButton: boolean } 
     */
    popup: function({ title = "Notification", message = "", autoCloseMs = 0, showCloseButton = true } = {}) {
      // It's possible popup components were just created natively
      if(!popupTitle) {
         popupTitle = popupOverlay.querySelector('h3');
         popupMessage = popupOverlay.querySelector('p');
         popupBtnWrapper = popupOverlay.querySelector('div');
      }

      popupTitle.innerText = title;
      popupMessage.innerText = message;
      
      if (showCloseButton) {
        popupBtnWrapper.style.display = 'block';
      } else {
        popupBtnWrapper.style.display = 'none';
      }
      
      popupOverlay.classList.add('show');
      
      if (autoCloseMs > 0) {
        setTimeout(() => {
          popupOverlay.classList.remove('show');
        }, autoCloseMs);
      }
    }
  };
})();
