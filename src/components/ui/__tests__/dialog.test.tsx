/**
 * @vitest-environment jsdom
 */
import React from "react";
import { render, screen, act } from "@testing-library/react";
// TODO: Replace jest-axe with vitest-compatible accessibility testing
// import { axe } from "jest-axe";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  Dialog,
// ... existing code ...
    // Mock console.error to catch warnings
    const originalConsoleError = console.error;
    const mockConsoleError = vi.fn();
    console.error = mockConsoleError;

    // Render the Dialog with DialogTitle as a direct child
// ... existing code ...
    // Mock console.error to catch warnings
    const originalConsoleError = console.error;
    const mockConsoleError = vi.fn();
    console.error = mockConsoleError;

    // Render the Dialog with DialogTitle NOT as a direct child
// ... existing code ...
    // Mock console.error to catch warnings
    const originalConsoleError = console.error;
    const mockConsoleError = vi.fn();
    console.error = mockConsoleError;

    // Render the Dialog with DialogTitle within another component
// ... existing code ...

  beforeEach(() => {
    // Mock console.error to catch warnings
    originalConsoleError = console.error;
    mockConsoleError = vi.fn();
    console.error = mockConsoleError;
  });

  afterEach(() => {
    // Restore console.error
    console.error = originalConsoleError;
  });
