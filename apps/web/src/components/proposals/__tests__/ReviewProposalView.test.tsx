import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ReviewProposalView from '../ReviewProposalView';
import { FunderDetails } from '../FunderDetailsView';
import { Question } from '../ApplicationQuestionsView';

describe('ReviewProposalView', () => {
  const mockOnSubmit = vi.fn();
  const mockOnBack = vi.fn();
  const mockOnEdit = vi.fn();
  
  const mockFunderDetails: FunderDetails = {
    funderName: 'Test Foundation',
    funderWebsite: 'https://testfoundation.org',
    funderType: 'Non-profit',
    funderDescription: 'A test foundation',
    deadline: '2023-12-31',
    programName: 'Test Program',
    programDescription: 'A test program'
  };
  
  const mockApplicationQuestions: Question[] = [
    {
      question: 'What is your project about?',
      required: true,
      maxLength: 500
    },
    {
      question: 'What is your budget?',
      required: true,
      maxLength: 200
    }
  ];
  
  it('renders RFP proposal type correctly', () => {
    render(
      <ReviewProposalView
        onSubmit={mockOnSubmit}
        onBack={mockOnBack}
        onEdit={mockOnEdit}
        funderDetails={mockFunderDetails}
        applicationQuestions={[]}
        proposalType="rfp"
      />
    );
    
    expect(screen.getByText('Review Your Proposal')).toBeInTheDocument();
    expect(screen.getByText('Funder Details')).toBeInTheDocument();
    expect(screen.getByText('RFP Documents')).toBeInTheDocument();
    expect(screen.getByText('Test Foundation')).toBeInTheDocument();
    expect(screen.getByText('https://testfoundation.org')).toBeInTheDocument();
    expect(screen.getByText('Non-profit')).toBeInTheDocument();
    expect(screen.getByText('A test foundation')).toBeInTheDocument();
  });
  
  it('renders application proposal type correctly', () => {
    render(
      <ReviewProposalView
        onSubmit={mockOnSubmit}
        onBack={mockOnBack}
        onEdit={mockOnEdit}
        funderDetails={mockFunderDetails}
        applicationQuestions={mockApplicationQuestions}
        proposalType="application"
      />
    );
    
    expect(screen.getByText('Review Your Proposal')).toBeInTheDocument();
    expect(screen.getByText('Funder Details')).toBeInTheDocument();
    expect(screen.getByText('Application Questions')).toBeInTheDocument();
    expect(screen.getByText('Test Program')).toBeInTheDocument();
    expect(screen.getByText('Test Foundation')).toBeInTheDocument();
    expect(screen.getByText('A test program')).toBeInTheDocument();
    expect(screen.getByText('What is your project about?')).toBeInTheDocument();
    expect(screen.getByText('What is your budget?')).toBeInTheDocument();
  });
  
  it('handles edit button clicks', () => {
    render(
      <ReviewProposalView
        onSubmit={mockOnSubmit}
        onBack={mockOnBack}
        onEdit={mockOnEdit}
        funderDetails={mockFunderDetails}
        applicationQuestions={mockApplicationQuestions}
        proposalType="application"
      />
    );
    
    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]); // Click on funder details edit
    
    expect(mockOnEdit).toHaveBeenCalledWith(1);
    
    fireEvent.click(editButtons[1]); // Click on application questions edit
    
    expect(mockOnEdit).toHaveBeenCalledWith(2);
  });
  
  it('handles back button click', () => {
    render(
      <ReviewProposalView
        onSubmit={mockOnSubmit}
        onBack={mockOnBack}
        onEdit={mockOnEdit}
        funderDetails={mockFunderDetails}
        applicationQuestions={mockApplicationQuestions}
        proposalType="application"
      />
    );
    
    const backButton = screen.getByText('Back');
    fireEvent.click(backButton);
    
    expect(mockOnBack).toHaveBeenCalled();
  });
  
  it('handles submit button click', () => {
    render(
      <ReviewProposalView
        onSubmit={mockOnSubmit}
        onBack={mockOnBack}
        onEdit={mockOnEdit}
        funderDetails={mockFunderDetails}
        applicationQuestions={mockApplicationQuestions}
        proposalType="application"
      />
    );
    
    const submitButton = screen.getByText('Submit Proposal');
    fireEvent.click(submitButton);
    
    expect(mockOnSubmit).toHaveBeenCalledWith({});
  });
  
  it('displays loading state when submitting', () => {
    render(
      <ReviewProposalView
        onSubmit={mockOnSubmit}
        onBack={mockOnBack}
        onEdit={mockOnEdit}
        funderDetails={mockFunderDetails}
        applicationQuestions={mockApplicationQuestions}
        proposalType="application"
        isSubmitting={true}
      />
    );
    
    expect(screen.getByText('Submitting...')).toBeInTheDocument();
    
    const backButton = screen.getByText('Back');
    const submitButton = screen.getByText('Submitting...');
    
    expect(backButton).toBeDisabled();
    expect(submitButton).toBeDisabled();
  });
});