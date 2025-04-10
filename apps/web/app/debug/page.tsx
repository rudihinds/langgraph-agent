"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function DebugPage() {
  const [baseUrl, setBaseUrl] = useState<string>("");
  const [assetPrefixInfo, setAssetPrefixInfo] = useState<string>("");
  const [cookieInfo, setCookieInfo] = useState<string[]>([]);
  const [envInfo, setEnvInfo] = useState<any>({});

  useEffect(() => {
    // Get base URL
    if (typeof window !== "undefined") {
      setBaseUrl(window.location.origin);

      // Check cookies
      const cookieList = document.cookie
        .split(";")
        .map((cookie) => cookie.trim())
        .filter((cookie) => cookie !== "");
      setCookieInfo(cookieList);

      // Check for asset prefix (look at script tags)
      const scripts = document.querySelectorAll("script");
      const scriptSources = Array.from(scripts)
        .map((script) => script.src)
        .filter((src) => src.includes("_next"));

      if (scriptSources.length > 0) {
        setAssetPrefixInfo(scriptSources[0]);
      }

      // Check for environment info
      setEnvInfo({
        userAgent: navigator.userAgent,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        nextData: window.__NEXT_DATA__ || "Not available",
      });
    }
  }, []);

  // Test links to check routing
  const testLinks = [
    { path: "/", label: "Home" },
    { path: "/login", label: "Login" },
    { path: "/dashboard", label: "Dashboard" },
    { path: "/dashboard/simple", label: "Simple Dashboard" },
    { path: "/dashboard/test-page", label: "Test Dashboard" },
    { path: "/not-found-page", label: "Non-existent Page" },
  ];

  // Test static assets
  const testAssets = [
    { path: "/_next/static/css/app.css", label: "Main CSS" },
    { path: "/_next/static/chunks/main.js", label: "Main JS" },
    { path: "/favicon.ico", label: "Favicon" },
  ];

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-4xl font-bold mb-6">Debug Page</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <div className="p-6 bg-card rounded-lg border">
          <h2 className="text-2xl font-semibold mb-4">Environment Info</h2>
          <div className="mb-4">
            <p>
              <strong>Base URL:</strong> {baseUrl}
            </p>
            <p>
              <strong>Asset Prefix Sample:</strong>{" "}
              {assetPrefixInfo || "Not detected"}
            </p>
          </div>

          <h3 className="text-xl font-medium mb-2">Browser Details</h3>
          <pre className="bg-muted p-4 rounded-md overflow-auto text-xs mb-4">
            {JSON.stringify(envInfo, null, 2)}
          </pre>
        </div>

        <div className="p-6 bg-card rounded-lg border">
          <h2 className="text-2xl font-semibold mb-4">Cookies</h2>
          {cookieInfo.length > 0 ? (
            <ul className="space-y-1">
              {cookieInfo.map((cookie, i) => (
                <li
                  key={i}
                  className="p-2 bg-muted rounded-md text-xs font-mono"
                >
                  {cookie}
                </li>
              ))}
            </ul>
          ) : (
            <p>No cookies found</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <div className="p-6 bg-card rounded-lg border">
          <h2 className="text-2xl font-semibold mb-4">Test Routes</h2>
          <div className="grid grid-cols-2 gap-2">
            {testLinks.map((link, i) => (
              <Link
                key={i}
                href={link.path}
                className="p-3 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md text-center"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="p-6 bg-card rounded-lg border">
          <h2 className="text-2xl font-semibold mb-4">Test Static Assets</h2>
          <div className="space-y-2">
            {testAssets.map((asset, i) => (
              <div key={i} className="flex items-center space-x-2">
                <AssetTester path={asset.path} label={asset.label} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="text-center mt-8">
        <Link href="/" className="text-primary hover:underline">
          Back to Home
        </Link>
      </div>
    </div>
  );
}

// Component to test if an asset loads
function AssetTester({ path, label }: { path: string; label: string }) {
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );

  useEffect(() => {
    fetch(path)
      .then((res) => {
        if (res.ok) {
          setStatus("success");
        } else {
          setStatus("error");
        }
      })
      .catch(() => {
        setStatus("error");
      });
  }, [path]);

  return (
    <div className="flex items-center space-x-2 p-2 bg-muted rounded-md w-full">
      <div
        className={`w-3 h-3 rounded-full ${
          status === "loading"
            ? "bg-yellow-500"
            : status === "success"
              ? "bg-green-500"
              : "bg-red-500"
        }`}
      ></div>
      <span className="text-sm flex-1">
        {label} ({path})
      </span>
      <span
        className={`text-xs ${
          status === "loading"
            ? "text-yellow-500"
            : status === "success"
              ? "text-green-500"
              : "text-red-500"
        }`}
      >
        {status === "loading"
          ? "Testing..."
          : status === "success"
            ? "Loaded"
            : "Failed"}
      </span>
    </div>
  );
}
