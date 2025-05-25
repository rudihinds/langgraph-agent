import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

/**
 * POST /api/proposals/[id]/upload - Upload a file for a specific proposal
 * Requires authentication
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { message: "Missing proposal ID" },
      { status: 400 }
    );
  }

  try {
    // Create a Supabase client
    const supabase = await createClient(cookies());

    // Check if user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Check if proposal exists and belongs to the user
    const { data: existingProposal, error: checkError } = await supabase
      .from("proposals")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (checkError || !existingProposal) {
      return NextResponse.json(
        { message: "Proposal not found or access denied" },
        { status: 404 }
      );
    }

    // Process the form data
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { message: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
      "application/msword", // .doc
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          message:
            "Invalid file type. Only PDF and Word documents are allowed.",
        },
        { status: 400 }
      );
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
      return NextResponse.json(
        {
          message: "File size exceeds the 10MB limit.",
        },
        { status: 400 }
      );
    }

    // Create a unique file path
    const filePath = `${user.id}/${id}/${file.name}`;

    // Convert file to Buffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload the file to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("proposal-documents")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Error uploading file:", uploadError);
      return NextResponse.json(
        { message: "Failed to upload file" },
        { status: 500 }
      );
    }

    // Get the public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("proposal-documents").getPublicUrl(filePath);

    // Update the proposal with the document information
    const documentInfo = {
      rfp_document: {
        name: file.name,
        url: publicUrl,
        size: file.size,
        type: file.type,
      },
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from("proposals")
      .update(documentInfo)
      .eq("id", id);

    if (updateError) {
      console.error("Error updating proposal with document info:", updateError);
      return NextResponse.json(
        { message: "Failed to update proposal with document info" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: "File uploaded successfully",
        file: {
          name: file.name,
          url: publicUrl,
          size: file.size,
          type: file.type,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in POST /api/proposals/[id]/upload:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
