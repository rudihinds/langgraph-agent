/**
 * Tests for ErrorBoundary component
 */
import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { ErrorBoundary } from '../error-boundary';
import { logger } from '@/lib/logger';

// Mock the logger
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

// A component that throws an error
const ErrorThrowingComponent = ({ shouldThrow = false }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>Normal component rendering</div>;
};

describe('ErrorBoundary', () => {
  // Suppress console errors during tests
  const originalConsoleError = console.error;
  beforeAll(() => {
    console.error = vi.fn();
  });
  
  afterAll(() => {
    console.error = originalConsoleError;
  });
  
  it('renders children when there is no error', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <div>Test Content</div>
      </ErrorBoundary>
    );
    
    expect(getByText('Test Content')).toBeInTheDocument();
  });
  
  it('renders fallback UI when a child component throws an error', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ErrorThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );
    
    // Check that the fallback UI is rendered
    expect(getByText(/Something went wrong/i)).toBeInTheDocument();
    expect(getByText(/try again/i)).toBeInTheDocument();
  });
  
  it('renders custom fallback when provided', () => {
    const customFallback = <div>Custom error message</div>;
    
    const { getByText } = render(
      <ErrorBoundary fallback={customFallback}>
        <ErrorThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );
    
    // Check that the custom fallback is rendered
    expect(getByText('Custom error message')).toBeInTheDocument();
  });
  
  it('logs the error when a component throws', () => {
    // The logger is already imported and mocked
    
    render(
      <ErrorBoundary>
        <ErrorThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );
    
    // Check that the error was logged
    expect(logger.error).toHaveBeenCalled();
    
    // Get the arguments from the first call
    const args = logger.error.mock.calls[0];
    
    // Check basic structure of the arguments
    expect(args[0]).toBe('React component error');
    expect(args[2]).toBeInstanceOf(Error);
    expect(args[2].message).toBe('Test error');
  });
  
  it('resets error state when "Try again" button is clicked', () => {
    // We need to control the shouldThrow prop to test recovery
    const TestComponent = () => {
      const [shouldThrow, setShouldThrow] = React.useState(true);
      
      return (
        <div>
          <button onClick={() => setShouldThrow(false)}>Fix Error</button>
          <ErrorBoundary>
            {shouldThrow ? (
              <ErrorThrowingComponent shouldThrow={true} />
            ) : (
              <div>Error fixed!</div>
            )}
          </ErrorBoundary>
        </div>
      );
    };
    
    const { getByText } = render(<TestComponent />);
    
    // Error boundary should show the fallback
    expect(getByText(/Something went wrong/i)).toBeInTheDocument();
    
    // Click "Try again" button
    fireEvent.click(getByText('Try again'));
    
    // Error should still show because the component still throws
    expect(getByText(/Something went wrong/i)).toBeInTheDocument();
    
    // Fix the error
    fireEvent.click(getByText('Fix Error'));
    
    // Now click "Try again"
    fireEvent.click(getByText('Try again'));
    
    // Error should be resolved
    expect(getByText('Error fixed!')).toBeInTheDocument();
  });
});