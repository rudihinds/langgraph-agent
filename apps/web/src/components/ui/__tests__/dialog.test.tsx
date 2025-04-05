"use client";

import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "../dialog";

describe("Dialog Accessibility Tests", () => {
  it("should not log accessibility errors when DialogTitle is a direct child of DialogContent", async () => {
    // Mock console.error to catch warnings
    const originalConsoleError = console.error;
    const mockConsoleError = jest.fn();
    console.error = mockConsoleError;

    try {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogTitle>Test Dialog</DialogTitle>
            <DialogDescription>This is a test dialog</DialogDescription>
            <div>Dialog content</div>
          </DialogContent>
        </Dialog>
      );

      // Check if the dialog is visible
      expect(screen.getByText("Test Dialog")).toBeInTheDocument();
      
      // Check that console.error was not called with accessibility warnings
      const accessibilityErrors = mockConsoleError.mock.calls.filter(
        call => call[0] && typeof call[0] === 'string' && 
        call[0].includes('DialogContent requires a DialogTitle')
      );

      expect(accessibilityErrors.length).toBe(0);
    } finally {
      // Restore console.error
      console.error = originalConsoleError;
    }
  });

  it("should log accessibility errors when DialogTitle is NOT a direct child of DialogContent", async () => {
    // Mock console.error to catch warnings
    const originalConsoleError = console.error;
    const mockConsoleError = jest.fn();
    console.error = mockConsoleError;

    try {
      render(
        <Dialog open={true}>
          <DialogContent>
            <div>
              <DialogTitle>Test Dialog</DialogTitle>
            </div>
            <DialogDescription>This is a test dialog</DialogDescription>
            <div>Dialog content</div>
          </DialogContent>
        </Dialog>
      );

      // Check if the dialog is visible
      expect(screen.getByText("Test Dialog")).toBeInTheDocument();
      
      // Check that console.error was called with accessibility warnings
      const accessibilityErrors = mockConsoleError.mock.calls.filter(
        call => call[0] && typeof call[0] === 'string' && 
        call[0].includes('DialogContent requires a DialogTitle')
      );

      // We expect to find accessibility errors in this case
      expect(accessibilityErrors.length).toBeGreaterThan(0);
    } finally {
      // Restore console.error
      console.error = originalConsoleError;
    }
  });

  it("should not log accessibility errors when DialogTitle is within another component", async () => {
    // Mock console.error to catch warnings
    const originalConsoleError = console.error;
    const mockConsoleError = jest.fn();
    console.error = mockConsoleError;

    // Create a wrapper component that includes DialogTitle
    const DialogHeader = ({ children }: React.PropsWithChildren) => (
      <div className="dialog-header">
        {children}
      </div>
    );

    try {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Test Dialog</DialogTitle>
            </DialogHeader>
            <DialogDescription>This is a test dialog</DialogDescription>
            <div>Dialog content</div>
          </DialogContent>
        </Dialog>
      );

      // Check if the dialog is visible
      expect(screen.getByText("Test Dialog")).toBeInTheDocument();
      
      // Check console.error calls for accessibility warnings
      const accessibilityErrors = mockConsoleError.mock.calls.filter(
        call => call[0] && typeof call[0] === 'string' && 
        call[0].includes('DialogContent requires a DialogTitle')
      );

      expect(accessibilityErrors.length).toBe(0);
    } finally {
      // Restore console.error
      console.error = originalConsoleError;
    }
  });
});