import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Hook to implement focus trapping in modals/dialogs
 * Keeps focus within the modal and restores it when modal closes
 */
export function useFocusTrap(isOpen: boolean, onEscapePress?: () => void) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Get all focusable elements within the container
  const getFocusableElements = useCallback(() => {
    if (!containerRef.current) return [];

    const selector = `
      a[href],
      button:not([disabled]),
      textarea:not([disabled]),
      input:not([disabled]),
      select:not([disabled]),
      [tabindex]:not([tabindex="-1"])
    `.replaceAll('\n', '');

    return Array.from(containerRef.current.querySelectorAll(selector));
  }, []);

  // Focus first focusable element
  const focusFirstElement = useCallback(() => {
    const focusable = getFocusableElements();
    if (focusable.length > 0) {
      (focusable[0] as HTMLElement).focus();
    }
  }, [getFocusableElements]);

  // Handle Tab key and keep focus within modal
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (onEscapePress) {
        onEscapePress();
      }
    }

    if (e.key === 'Tab') {
      const focusable = getFocusableElements();
      if (focusable.length === 0) return;

      const focusedIndex = focusable.indexOf(document.activeElement as HTMLElement);
      const lastIndex = focusable.length - 1;

      if (e.shiftKey) {
        // Shift+Tab - go to previous element or wrap to last
        if (focusedIndex <= 0) {
          e.preventDefault();
          (focusable[lastIndex] as HTMLElement).focus();
        }
      } else {
        // Tab - go to next element or wrap to first
        if (focusedIndex >= lastIndex) {
          e.preventDefault();
          (focusable[0] as HTMLElement).focus();
        }
      }
    }
  }, [getFocusableElements, onEscapePress]);

  useEffect(() => {
    if (!isOpen) return;

    // Save currently focused element to restore later
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Focus first element after a brief delay to allow render
    const timer = setTimeout(() => {
      focusFirstElement();
    }, 0);

    // Add keyboard listener
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);

      // Restore focus to previously focused element
      if (previousActiveElement.current && previousActiveElement.current.focus) {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen, focusFirstElement, handleKeyDown]);

  return containerRef;
}

/**
 * Hook to respect user's motion preferences
 * Returns whether animations should be enabled
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Check media query
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    // Listen for changes
    const handler = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReducedMotion;
}

/**
 * Hook for managing keyboard shortcuts
 * Usage: useKeyboardShortcuts({ 'cmd+k': () => {...} })
 */
export function useKeyboardShortcuts(shortcuts: Record<string, () => void>) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      // Cmd+K or Ctrl+K for search focus
      if ((e.key === 'k' || e.key === 'K') && modKey) {
        e.preventDefault();
        shortcuts['cmd+k']?.();
      }

      // ESC key
      if (e.key === 'Escape') {
        shortcuts['escape']?.();
      }

      // Cmd+/ or Ctrl+/ for help (if implemented)
      if ((e.key === '/' || e.key === '?') && modKey) {
        e.preventDefault();
        shortcuts['cmd+/']?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}
