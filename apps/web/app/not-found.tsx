export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-4xl font-bold mb-4">404</h1>
      <p className="text-lg text-muted-foreground mb-8">Page not found</p>
      <a href="/" className="text-primary hover:underline">
        Go back home
      </a>
    </div>
  );
}
