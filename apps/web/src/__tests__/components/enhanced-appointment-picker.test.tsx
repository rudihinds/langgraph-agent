import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EnhancedAppointmentPicker } from '@/components/ui/enhanced-appointment-picker';
import { formatDateForUI } from '@/lib/utils/date-utils';

// Mock the modules we need to avoid DOM issues in tests
jest.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div data-testid="popover">{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="popover-content">{children}</div>
  ),
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="popover-trigger">{children}</div>
  ),
}));

jest.mock('@/components/ui/calendar', () => ({
  Calendar: ({ onSelect }: { onSelect: (date: Date) => void }) => (
    <div data-testid="calendar">
      <button
        onClick={() => onSelect(new Date(2024, 0, 15))}
        data-testid="calendar-select-date"
      >
        Select Jan 15, 2024
      </button>
    </div>
  ),
}));

describe('EnhancedAppointmentPicker', () => {
  const mockOnDateChange = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with a label when provided', () => {
    render(
      <EnhancedAppointmentPicker
        date={undefined}
        onDateChange={mockOnDateChange}
        label="Test Label"
      />
    );
    
    expect(screen.getByText('Test Label')).toBeInTheDocument();
  });

  it('renders without a label when not provided', () => {
    render(
      <EnhancedAppointmentPicker
        date={undefined}
        onDateChange={mockOnDateChange}
      />
    );
    
    expect(screen.queryByText('Test Label')).not.toBeInTheDocument();
  });

  it('displays the provided date correctly formatted', () => {
    const testDate = new Date(2024, 0, 15);
    const formattedDate = formatDateForUI(testDate);
    
    render(
      <EnhancedAppointmentPicker
        date={testDate}
        onDateChange={mockOnDateChange}
      />
    );
    
    expect(screen.getByDisplayValue(formattedDate)).toBeInTheDocument();
  });

  it('uses the provided placeholder when no date is selected', () => {
    const customPlaceholder = 'Choose a date';
    
    render(
      <EnhancedAppointmentPicker
        date={undefined}
        onDateChange={mockOnDateChange}
        placeholder={customPlaceholder}
      />
    );
    
    expect(screen.getByPlaceholderText(customPlaceholder)).toBeInTheDocument();
  });

  it('displays an error message when provided', () => {
    const errorMessage = 'This field is required';
    
    render(
      <EnhancedAppointmentPicker
        date={undefined}
        onDateChange={mockOnDateChange}
        error={errorMessage}
      />
    );
    
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it('calls onDateChange when a date is selected from the calendar', () => {
    render(
      <EnhancedAppointmentPicker
        date={undefined}
        onDateChange={mockOnDateChange}
      />
    );
    
    fireEvent.click(screen.getByTestId('calendar-select-date'));
    
    expect(mockOnDateChange).toHaveBeenCalledWith(expect.any(Date));
    const calledWithDate = mockOnDateChange.mock.calls[0][0];
    expect(calledWithDate.getFullYear()).toBe(2024);
    expect(calledWithDate.getMonth()).toBe(0); // January
    expect(calledWithDate.getDate()).toBe(15);
  });

  it('calls onDateChange when a valid date is typed in', () => {
    render(
      <EnhancedAppointmentPicker
        date={undefined}
        onDateChange={mockOnDateChange}
      />
    );
    
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '15/01/2024' } });
    
    expect(mockOnDateChange).toHaveBeenCalled();
    const calledWithDate = mockOnDateChange.mock.calls[0][0];
    expect(calledWithDate.getFullYear()).toBe(2024);
    expect(calledWithDate.getMonth()).toBe(0); // January
    expect(calledWithDate.getDate()).toBe(15);
  });

  it('is disabled when disabled prop is true', () => {
    render(
      <EnhancedAppointmentPicker
        date={undefined}
        onDateChange={mockOnDateChange}
        disabled={true}
      />
    );
    
    expect(screen.getByRole('textbox')).toBeDisabled();
  });
}); 