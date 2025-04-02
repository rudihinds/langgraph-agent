import { render, screen } from "@testing-library/react";
import NewProposalPage from "../page";

// Mock dependencies
jest.mock("next/link", () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => {
    return <a href={href}>{children}</a>;
  };
});

describe("New Proposal Page", () => {
  it("renders the form with all required fields", () => {
    render(<NewProposalPage />);

    // Check for page title and description
    expect(screen.getByText("Create New Proposal")).toBeInTheDocument();
    expect(
      screen.getByText(/Start a new proposal by filling out/i)
    ).toBeInTheDocument();

    // Check for form fields
    expect(screen.getByLabelText("Proposal Title")).toBeInTheDocument();
    expect(screen.getByLabelText("Organization Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Funding Organization")).toBeInTheDocument();
    expect(screen.getByLabelText("Brief Description")).toBeInTheDocument();
    expect(screen.getByLabelText("RFP Document")).toBeInTheDocument();

    // Check for buttons
    expect(
      screen.getByRole("button", { name: /Create Proposal/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Cancel/i })).toBeInTheDocument();
  });

  it("renders back to dashboard link", () => {
    render(<NewProposalPage />);

    // Check for back link
    const backLink = screen.getByText("Back to Dashboard");
    expect(backLink).toBeInTheDocument();
    expect(backLink.closest("a")).toHaveAttribute("href", "/dashboard");
  });

  it("includes file upload functionality", () => {
    render(<NewProposalPage />);

    // Check for file upload elements
    expect(screen.getByText("Upload a file")).toBeInTheDocument();
    expect(screen.getByText("or drag and drop")).toBeInTheDocument();
    expect(screen.getByText(/PDF, DOC, DOCX, or TXT/i)).toBeInTheDocument();

    // Check that the file input exists
    const fileInput = document.getElementById(
      "file-upload"
    ) as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();
    expect(fileInput.type).toBe("file");
  });

  it("has a cancel button that links back to dashboard", () => {
    render(<NewProposalPage />);

    // Check cancel button
    const cancelButton = screen.getByRole("link", { name: /Cancel/i });
    expect(cancelButton).toBeInTheDocument();
    expect(cancelButton).toHaveAttribute("href", "/dashboard");
  });
});
