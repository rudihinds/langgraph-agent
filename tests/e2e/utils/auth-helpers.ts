import { Page } from "@playwright/test";

// Mock user data
export const mockUser = {
  id: "test-user-id",
  email: "test@example.com",
  user_metadata: {
    full_name: "Test User",
    avatar_url: "https://via.placeholder.com/150",
  },
};

/**
 * Mocks Supabase authentication by intercepting API requests
 * This simulates a logged-in user without going through the actual OAuth flow
 */
export async function mockSupabaseAuth(page: Page): Promise<void> {
  // Enable request/response logging for debugging
  page.on("request", (request) =>
    console.log(`>> ${request.method()} ${request.url()}`)
  );

  page.on("response", (response) =>
    console.log(`<< ${response.status()} ${response.url()}`)
  );

  // Get the actual Supabase URL from the page environment
  const supabaseUrl = await page.evaluate(() => {
    return (
      window.ENV?.NEXT_PUBLIC_SUPABASE_URL ||
      "https://rqwgqyhonjnzvgwxbrvh.supabase.co"
    );
  });

  console.log(`Using Supabase URL for mocking: ${supabaseUrl}`);

  // Intercept all Supabase auth endpoint calls
  await page.route(`${supabaseUrl}/auth/v1/**`, async (route) => {
    console.log(`Intercepting Supabase auth request: ${route.request().url()}`);

    // Default mock response for any auth endpoint
    const mockResponse = {
      access_token: "mock-access-token",
      token_type: "bearer",
      expires_in: 3600,
      refresh_token: "mock-refresh-token",
      user: mockUser,
      session: {
        access_token: "mock-access-token",
        refresh_token: "mock-refresh-token",
        expires_at: Date.now() + 3600000,
        user: mockUser,
      },
    };

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockResponse),
    });
  });

  // Inject a script to manually override Supabase auth state
  await page.addScriptTag({
    content: `
      console.log("Injecting mock auth script...");
      
      // Create a MutationObserver to watch for Supabase client initialization
      const observer = new MutationObserver((mutations) => {
        try {
          // Check if we have access to window.supabase
          if (window.supabase && window.supabase.auth) {
            console.log("Supabase client detected, attempting to override auth state");
            
            // Try to force the auth state by directly setting it
            window.supabase.auth.onAuthStateChange = (callback) => {
              callback('SIGNED_IN', {
                access_token: 'mock-access-token',
                refresh_token: 'mock-refresh-token',
                expires_at: Date.now() + 3600000,
                user: {
                  id: 'test-user-id',
                  email: 'test@example.com',
                  user_metadata: {
                    full_name: 'Test User',
                    avatar_url: 'https://via.placeholder.com/150',
                  },
                },
              });
              return { data: { subscription: { unsubscribe: () => {} } } };
            };
            
            // Force auth state change event
            window.supabase.auth._notifyAllSubscribers('SIGNED_IN', {
              access_token: 'mock-access-token',
              user: {
                id: 'test-user-id',
                email: 'test@example.com',
                user_metadata: {
                  full_name: 'Test User',
                  avatar_url: 'https://via.placeholder.com/150',
                },
              },
            });
            
            console.log("Auth state override attempted");
            observer.disconnect();
          }
        } catch (e) {
          console.error("Error in auth override:", e);
        }
      });
      
      // Start observing
      observer.observe(document, { 
        childList: true, 
        subtree: true 
      });
      
      // Also add a direct check after 1 second
      setTimeout(() => {
        try {
          if (window.supabase && window.supabase.auth) {
            console.log("Delayed auth override attempt");
            window.supabase.auth._notifyAllSubscribers('SIGNED_IN', {
              access_token: 'mock-access-token',
              user: {
                id: 'test-user-id',
                email: 'test@example.com',
                user_metadata: {
                  full_name: 'Test User',
                  avatar_url: 'https://via.placeholder.com/150',
                },
              },
            });
          }
        } catch (e) {
          console.error("Error in delayed auth override:", e);
        }
      }, 1000);
    `,
  });

  // Set auth cookies with domain and path that will definitely be accessible
  await page.context().addCookies([
    {
      name: "sb-access-token",
      value: "mock-access-token",
      domain: "localhost",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
    {
      name: "sb-refresh-token",
      value: "mock-refresh-token",
      domain: "localhost",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);

  // Navigate to home page to establish our mocks
  await page.goto("/");

  // Add a small delay to ensure everything is properly set up
  await page.waitForTimeout(2000);
}

/**
 * Helper function to verify user is authenticated in the UI
 * With additional debugging if the element is not found
 */
export async function verifyAuthenticated(page: Page): Promise<void> {
  try {
    // Wait for the avatar to be visible (indicates auth is successful)
    await page.waitForSelector('[data-testid="user-avatar"]', {
      timeout: 10000,
    });
  } catch (error) {
    console.error("Failed to find user avatar. Current page content:");
    console.log(await page.content());
    throw error;
  }
}
