import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

/**
 * GET /api/proposals/[id] - Get a specific proposal
 * Requires authentication
 */
export async function GET(
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

    // Fetch the proposal
    const { data: proposal, error } = await supabase
      .from("proposals")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error) {
      console.error("Error fetching proposal:", error);
      return NextResponse.json(
        { message: "Proposal not found or access denied" },
        { status: 404 }
      );
    }

    return NextResponse.json(proposal);
  } catch (error) {
    console.error("Error in GET /api/proposals/[id]:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/proposals/[id] - Update a specific proposal
 * Requires authentication
 */
export async function PATCH(
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

    // Parse request body
    const body = await req.json();

    // Add updated_at timestamp
    const updateData = {
      ...body,
      updated_at: new Date().toISOString(),
    };

    // Update the proposal
    const { data: updatedProposal, error } = await supabase
      .from("proposals")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating proposal:", error);
      return NextResponse.json(
        { message: "Failed to update proposal" },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedProposal);
  } catch (error) {
    console.error("Error in PATCH /api/proposals/[id]:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/proposals/[id] - Delete a specific proposal
 * Requires authentication
 */
export async function DELETE(
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

    // Delete any associated files first
    const { data: files, error: filesError } = await supabase.storage
      .from("proposal-documents")
      .list(`${user.id}/${id}`);

    if (!filesError && files && files.length > 0) {
      const filePaths = files.map(
        (file: any) => `${user.id}/${id}/${file.name}`
      );
      await supabase.storage.from("proposal-documents").remove(filePaths);
    }

    // Delete the proposal
    const { error } = await supabase.from("proposals").delete().eq("id", id);

    if (error) {
      console.error("Error deleting proposal:", error);
      return NextResponse.json(
        { message: "Failed to delete proposal" },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Proposal deleted successfully" });
  } catch (error) {
    console.error("Error in DELETE /api/proposals/[id]:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
