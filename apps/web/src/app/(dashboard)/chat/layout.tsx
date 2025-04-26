import React from "react";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col flex-grow h-full">
      <div className="flex-grow overflow-hidden">{children}</div>
    </div>
  );
}
