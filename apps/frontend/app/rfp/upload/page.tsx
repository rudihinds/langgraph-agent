"use client";

import { useState } from "react";
import { RfpUploader } from "../../../components/RfpUploader";
import { Heading } from "../../../components/ui/heading";
import { Separator } from "../../../components/ui/separator";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";

interface ParsedRFP {
  text: string;
  metadata: {
    filename: string;
    mimeType: string;
    pageCount?: number;
    wordCount?: number;
    charCount?: number;
    [key: string]: any;
  };
}

export default function RfpUploadPage() {
  const [parsedDocument, setParsedDocument] = useState<ParsedRFP | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleDocumentParsed = (data: ParsedRFP) => {
    setParsedDocument(data);
    setIsSuccess(true);

    // In a real app, here we would:
    // 1. Save the document to the database
    // 2. Start the research process
    // 3. Redirect to a status page or dashboard
  };

  return (
    <div className="container py-10">
      <div className="flex items-center justify-between mb-4">
        <div className="space-y-1">
          <Heading>Upload RFP Document</Heading>
          <p className="text-muted-foreground">
            Upload a Request for Proposal (RFP) document to analyze and generate
            a response.
          </p>
        </div>
        <Link href="/dashboard">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
      </div>

      <Separator className="my-6" />

      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <RfpUploader onParsed={handleDocumentParsed} />
        </div>

        <div>
          {isSuccess ? (
            <Card>
              <CardHeader className="bg-green-50 border-b">
                <CardTitle className="flex items-center text-green-700">
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                  Document Successfully Processed
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium text-sm mb-1">
                      Document Information
                    </h3>
                    <ul className="space-y-1 text-sm">
                      <li>
                        <span className="font-medium">Filename:</span>{" "}
                        {parsedDocument?.metadata.filename}
                      </li>
                      <li>
                        <span className="font-medium">Type:</span>{" "}
                        {parsedDocument?.metadata.mimeType}
                      </li>
                      {parsedDocument?.metadata.pageCount && (
                        <li>
                          <span className="font-medium">Pages:</span>{" "}
                          {parsedDocument.metadata.pageCount}
                        </li>
                      )}
                      {parsedDocument?.metadata.wordCount && (
                        <li>
                          <span className="font-medium">Words:</span>{" "}
                          {parsedDocument.metadata.wordCount.toLocaleString()}
                        </li>
                      )}
                      {parsedDocument?.metadata.charCount && (
                        <li>
                          <span className="font-medium">Characters:</span>{" "}
                          {parsedDocument.metadata.charCount.toLocaleString()}
                        </li>
                      )}
                    </ul>
                  </div>

                  <div className="pt-2">
                    <Button>Continue to Analysis</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>How It Works</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="list-decimal list-inside space-y-3">
                  <li className="text-sm">
                    <span className="font-medium">
                      Upload your RFP document
                    </span>
                    <p className="text-muted-foreground mt-1 ml-5">
                      We support PDF, plain text, and markdown formats.
                    </p>
                  </li>
                  <li className="text-sm">
                    <span className="font-medium">
                      Our AI analyzes the document
                    </span>
                    <p className="text-muted-foreground mt-1 ml-5">
                      We extract key requirements, deadlines, and evaluation
                      criteria.
                    </p>
                  </li>
                  <li className="text-sm">
                    <span className="font-medium">
                      Generate a tailored response
                    </span>
                    <p className="text-muted-foreground mt-1 ml-5">
                      Our system helps you create a compelling proposal based on
                      the RFP analysis.
                    </p>
                  </li>
                  <li className="text-sm">
                    <span className="font-medium">Review and export</span>
                    <p className="text-muted-foreground mt-1 ml-5">
                      Edit the generated content and export it in your preferred
                      format.
                    </p>
                  </li>
                </ol>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
