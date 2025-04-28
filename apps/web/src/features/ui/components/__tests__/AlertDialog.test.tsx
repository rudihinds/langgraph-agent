import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../alert-dialog";

// Helper to render a complete AlertDialog for testing
const renderAlertDialog = ({
  title = "Are you sure?",
  description = "This action cannot be undone",
  confirmText = "Continue",
  cancelText = "Cancel",
  onConfirm = vi.fn(),
  onCancel = vi.fn(),
} = {}) => {
  render(
    <AlertDialog>
      <AlertDialogTrigger data-testid="trigger-button">
        Open Dialog
      </AlertDialogTrigger>
      <AlertDialogContent data-testid="dialog-content">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="cancel-button" onClick={onCancel}>
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction data-testid="confirm-button" onClick={onConfirm}>
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return {
    onConfirm,
    onCancel,
  };
};

describe("AlertDialog Component", () => {
  it("renders with a trigger button but content hidden by default", () => {
    renderAlertDialog();

    // Trigger should be visible
    expect(screen.getByTestId("trigger-button")).toBeInTheDocument();

    // Content should not be visible initially
    expect(screen.queryByTestId("dialog-content")).not.toBeInTheDocument();
  });

  it("opens dialog when trigger is clicked", async () => {
    renderAlertDialog();

    // Click the trigger button
    fireEvent.click(screen.getByTestId("trigger-button"));

    // Dialog content should now be visible
    await waitFor(() => {
      expect(screen.getByTestId("dialog-content")).toBeInTheDocument();
    });

    // Check title and description
    expect(screen.getByText("Are you sure?")).toBeInTheDocument();
    expect(
      screen.getByText("This action cannot be undone")
    ).toBeInTheDocument();
  });

  it("closes dialog when cancel button is clicked", async () => {
    const { onCancel } = renderAlertDialog();

    // Open the dialog
    fireEvent.click(screen.getByTestId("trigger-button"));

    // Dialog should be open
    await waitFor(() => {
      expect(screen.getByTestId("dialog-content")).toBeInTheDocument();
    });

    // Click the cancel button
    fireEvent.click(screen.getByTestId("cancel-button"));

    // Dialog should be closed
    await waitFor(() => {
      expect(screen.queryByTestId("dialog-content")).not.toBeInTheDocument();
    });

    // Cancel callback should have been called
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onConfirm when confirm button is clicked", async () => {
    const { onConfirm } = renderAlertDialog();

    // Open the dialog
    fireEvent.click(screen.getByTestId("trigger-button"));

    // Click the confirm button
    await waitFor(() => {
      expect(screen.getByTestId("confirm-button")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("confirm-button"));

    // Confirm callback should have been called
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("renders with custom text for title, description, and buttons", async () => {
    renderAlertDialog({
      title: "Custom Title",
      description: "Custom Description",
      confirmText: "Yes, do it",
      cancelText: "No, go back",
    });

    // Open the dialog
    fireEvent.click(screen.getByTestId("trigger-button"));

    // Check custom text
    await waitFor(() => {
      expect(screen.getByText("Custom Title")).toBeInTheDocument();
      expect(screen.getByText("Custom Description")).toBeInTheDocument();
      expect(screen.getByText("Yes, do it")).toBeInTheDocument();
      expect(screen.getByText("No, go back")).toBeInTheDocument();
    });
  });

  it("supports keyboard navigation", async () => {
    const user = userEvent.setup();
    const { onCancel } = renderAlertDialog();

    // Open the dialog
    await user.click(screen.getByTestId("trigger-button"));

    // Dialog should be open
    await waitFor(() => {
      expect(screen.getByTestId("dialog-content")).toBeInTheDocument();
    });

    // Press Escape to close the dialog
    await user.keyboard("{Escape}");

    // Dialog should be closed
    await waitFor(() => {
      expect(screen.queryByTestId("dialog-content")).not.toBeInTheDocument();
    });
  });
});
