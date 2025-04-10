import { render, screen } from "@testing-library/react";
import { Alert, AlertTitle, AlertDescription } from "../alert";
import { AlertCircle, Info, AlertTriangle } from "lucide-react";

describe("Alert Component", () => {
  it("renders the Alert component with default variant", () => {
    render(
      <Alert data-testid="alert">
        <Info className="h-4 w-4" />
        <AlertTitle>Information</AlertTitle>
        <AlertDescription>This is an informational alert</AlertDescription>
      </Alert>
    );

    const alert = screen.getByTestId("alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveClass("bg-background");
    expect(screen.getByText("Information")).toBeInTheDocument();
    expect(
      screen.getByText("This is an informational alert")
    ).toBeInTheDocument();
  });

  it("renders with destructive variant", () => {
    render(
      <Alert variant="destructive" data-testid="alert">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>This is an error alert</AlertDescription>
      </Alert>
    );

    const alert = screen.getByTestId("alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveClass("border-destructive");
    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByText("This is an error alert")).toBeInTheDocument();
  });

  it("renders with warning variant", () => {
    render(
      <Alert variant="warning" data-testid="alert">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Warning</AlertTitle>
        <AlertDescription>This is a warning alert</AlertDescription>
      </Alert>
    );

    const alert = screen.getByTestId("alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveClass("border-amber-300");
    expect(screen.getByText("Warning")).toBeInTheDocument();
    expect(screen.getByText("This is a warning alert")).toBeInTheDocument();
  });

  it("accepts and applies additional className", () => {
    render(
      <Alert className="custom-class" data-testid="alert">
        <AlertDescription>Alert with custom class</AlertDescription>
      </Alert>
    );

    const alert = screen.getByTestId("alert");
    expect(alert).toHaveClass("custom-class");
  });

  it("renders AlertTitle and AlertDescription independently", () => {
    render(
      <>
        <AlertTitle data-testid="title" className="custom-title">
          Standalone Title
        </AlertTitle>
        <AlertDescription data-testid="description" className="custom-desc">
          Standalone Description
        </AlertDescription>
      </>
    );

    const title = screen.getByTestId("title");
    const description = screen.getByTestId("description");

    expect(title).toBeInTheDocument();
    expect(title).toHaveClass("custom-title");
    expect(title).toHaveTextContent("Standalone Title");

    expect(description).toBeInTheDocument();
    expect(description).toHaveClass("custom-desc");
    expect(description).toHaveTextContent("Standalone Description");
  });
});
