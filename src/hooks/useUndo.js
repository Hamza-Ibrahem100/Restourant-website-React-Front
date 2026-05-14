import { useState, useCallback } from 'react';

/**
 * Custom hook for Undo/Redo state management (Stacks Method).
 * Keeps track of past, present, and future states.
 */
export function useUndo(initialPresent) {
  const [state, setState] = useState({
    past: [],
    present: initialPresent,
    future: []
  });

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  const undo = useCallback(() => {
    setState(currentState => {
      const { past, present, future } = currentState;
      if (past.length === 0) return currentState;
      
      const previous = past[past.length - 1];
      const newPast = past.slice(0, past.length - 1);
      
      return {
        past: newPast,
        present: previous,
        future: [present, ...future]
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState(currentState => {
      const { past, present, future } = currentState;
      if (future.length === 0) return currentState;
      
      const next = future[0];
      const newFuture = future.slice(1);
      
      return {
        past: [...past, present],
        present: next,
        future: newFuture
      };
    });
  }, []);

  const set = useCallback((newPresent) => {
    setState(currentState => {
      const { past, present } = currentState;
      
      // Prevent adding a new state if it's identical
      if (newPresent === present) return currentState;
      
      return {
        past: [...past, present],
        present: newPresent,
        future: [] // Adding a new state clears the redo future
      };
    });
  }, []);

  const reset = useCallback((newPresent) => {
    setState({
      past: [],
      present: newPresent,
      future: []
    });
  }, []);

  return [state.present, { set, reset, undo, redo, canUndo, canRedo }];
}
