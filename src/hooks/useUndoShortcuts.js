import { useEffect } from 'react';

/**
 * Custom hook that listens for keyboard events to trigger undo/redo actions.
 * Prevents default browser actions when these shortcuts are used.
 * 
 * Shortcuts:
 * Ctrl+Z / Cmd+Z -> Undo
 * Ctrl+Y / Cmd+Y / Ctrl+Shift+Z / Cmd+Shift+Z -> Redo
 */
export function useUndoShortcuts(undo, redo) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Ignore keypresses originating from input fields, textareas, etc.
      // This allows the native browser Undo/Redo to work for typing
      const activeElement = document.activeElement;
      if (activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' || 
        activeElement.tagName === 'SELECT'
      )) {
        return;
      }

      // Check if Ctrl (Windows/Linux) or Cmd (Mac) is pressed
      if (event.ctrlKey || event.metaKey) {
        
        // 'Z' key logic
        if (event.key.toLowerCase() === 'z') {
          if (event.shiftKey) {
            // Ctrl+Shift+Z -> Redo
            event.preventDefault();
            redo();
          } else {
            // Ctrl+Z -> Undo
            event.preventDefault();
            undo();
          }
        } 
        
        // 'Y' key logic
        else if (event.key.toLowerCase() === 'y') {
          // Ctrl+Y -> Redo
          event.preventDefault();
          redo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    // Cleanup event listener on unmount
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [undo, redo]);
}
