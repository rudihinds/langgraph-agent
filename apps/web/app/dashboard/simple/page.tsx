export default function SimpleDashboardPage() {
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-4xl font-bold mb-6">Simple Dashboard Test</h1>

      <div className="p-6 bg-card rounded-lg shadow-sm border mb-8">
        <h2 className="text-2xl font-semibold mb-4">Static Assets Test</h2>
        <p className="mb-4">
          This page should display with proper styling if static assets are
          loading correctly.
        </p>

        <div className="flex space-x-4 mb-4">
          <div className="w-32 h-32 bg-primary rounded-lg flex items-center justify-center text-white">
            Primary
          </div>
          <div className="w-32 h-32 bg-secondary rounded-lg flex items-center justify-center">
            Secondary
          </div>
          <div className="w-32 h-32 bg-accent rounded-lg flex items-center justify-center">
            Accent
          </div>
          <div className="w-32 h-32 bg-muted rounded-lg flex items-center justify-center">
            Muted
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <a
            href="/"
            className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md text-center"
          >
            Home Page
          </a>
          <a
            href="/dashboard"
            className="px-4 py-2 bg-secondary text-secondary-foreground hover:bg-secondary/90 rounded-md text-center"
          >
            Full Dashboard
          </a>
          <a
            href="/dashboard/test-page"
            className="px-4 py-2 bg-accent text-accent-foreground hover:bg-accent/90 rounded-md text-center"
          >
            Test Dashboard
          </a>
          <a
            href="/login"
            className="px-4 py-2 bg-muted text-muted-foreground hover:bg-muted/90 rounded-md text-center"
          >
            Login Page
          </a>
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        <p>This is a simple test page without complex components.</p>
        <p>Current time: {new Date().toLocaleTimeString()}</p>
      </div>
    </div>
  );
}
