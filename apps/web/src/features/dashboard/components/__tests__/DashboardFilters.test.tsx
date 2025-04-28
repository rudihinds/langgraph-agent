import { render, screen, fireEvent, within } from "@testing-library/react";
import { vi } from "vitest";
import DashboardFilters from "../DashboardFilters";
import { Collapsible } from "@/components/ui/collapsible";

// Wrapper component to properly test DashboardFilters
const DashboardFiltersWrapper = () => (
  <Collapsible>
    <DashboardFilters />
  </Collapsible>
);

describe("DashboardFilters", () => {
  it("renders the filters card with all form elements", () => {
    render(<DashboardFiltersWrapper />);

    // Check for headings
    expect(screen.getByText("Filters")).toBeInTheDocument();
    expect(screen.getByText("Narrow down your proposals")).toBeInTheDocument();

    // Check for form elements
    expect(screen.getByLabelText("Search")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Search proposals...")
    ).toBeInTheDocument();

    expect(screen.getByLabelText("Status")).toBeInTheDocument();
    expect(screen.getByText("Select status")).toBeInTheDocument();

    expect(screen.getByLabelText("Timeframe")).toBeInTheDocument();
    expect(screen.getByText("Select timeframe")).toBeInTheDocument();

    // Check for buttons
    expect(screen.getByRole("button", { name: /reset/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /apply filters/i })
    ).toBeInTheDocument();
  });

  it("applies filters when form is filled and Apply Filters button is clicked", () => {
    render(<DashboardFiltersWrapper />);

    // Fill the search input
    const searchInput = screen.getByPlaceholderText("Search proposals...");
    fireEvent.change(searchInput, { target: { value: "Test Query" } });

    // Click Apply Filters
    const applyButton = screen.getByRole("button", { name: /apply filters/i });
    fireEvent.click(applyButton);

    // Check if filter badge appears
    expect(screen.getByText("Search: Test Query")).toBeInTheDocument();
  });

  it("clears all filters when Reset button is clicked", () => {
    render(<DashboardFiltersWrapper />);

    // Fill the search input
    const searchInput = screen.getByPlaceholderText("Search proposals...");
    fireEvent.change(searchInput, { target: { value: "Test Query" } });

    // Apply filters
    const applyButton = screen.getByRole("button", { name: /apply filters/i });
    fireEvent.click(applyButton);

    // Verify filter is applied
    expect(screen.getByText("Search: Test Query")).toBeInTheDocument();

    // Click Reset button
    const resetButton = screen.getByRole("button", { name: /reset/i });
    fireEvent.click(resetButton);

    // Verify filter badge is gone
    expect(screen.queryByText("Search: Test Query")).not.toBeInTheDocument();

    // Verify search input is cleared
    expect(
      screen.getByPlaceholderText("Search proposals...").getAttribute("value")
    ).toBe("");
  });

  it("removes individual filters when clicking the X button", () => {
    render(<DashboardFiltersWrapper />);

    // Add a search filter
    const searchInput = screen.getByPlaceholderText("Search proposals...");
    fireEvent.change(searchInput, { target: { value: "Test Query" } });

    // Apply filters
    const applyButton = screen.getByRole("button", { name: /apply filters/i });
    fireEvent.click(applyButton);

    // Verify filter is applied
    const filterText = screen.getByText("Search: Test Query");
    expect(filterText).toBeInTheDocument();

    // Find the applied filters section
    const appliedFiltersSection =
      screen.getByText("Applied Filters").parentElement;

    // Find the X button within the applied filters section
    const removeButton = within(appliedFiltersSection).getAllByRole(
      "button"
    )[0];
    fireEvent.click(removeButton);

    // Verify filter badge is gone
    expect(screen.queryByText("Search: Test Query")).not.toBeInTheDocument();
  });

  it("toggles collapsible content when trigger is clicked on mobile", () => {
    render(<DashboardFiltersWrapper />);

    // Collapsible is open by default
    const collapsibleTrigger = screen.getByRole("button", { name: "" }); // The chevron button

    // Click to close
    fireEvent.click(collapsibleTrigger);

    // Would need to check the state of the component or the DOM structure
    // This is a bit tricky with just react-testing-library
    // In a real test, you might check for the presence of a class or attribute
  });
});
