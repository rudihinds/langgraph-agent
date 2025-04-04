import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { ProposalSchema } from "@/schemas/proposal";
import type { User } from "@supabase/supabase-js";
import { z } from "zod";

/**
 * POST /api/proposals - Create a new proposal
 * Requires authentication
 */
export async function POST(req: Request) {
  try {
    // Parse the request body
    const body = await req.json();

    // Validate the request body
    const validationResult = ProposalSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          message: "Invalid proposal data",
          errors: validationResult.error.format(),
        },
        { status: 400 }
      );
    }

    // Create a Supabase client
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    // Check if user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Add user_id to the proposal data
    const proposalData = {
      ...validationResult.data,
      user_id: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Insert the proposal into the database
    const { data: proposal, error } = await supabase
      .from("proposals")
      .insert(proposalData)
      .select()
      .single();

    if (error) {
      console.error("Error creating proposal:", error);
      return NextResponse.json(
        { message: "Failed to create proposal" },
        { status: 500 }
      );
    }

    return NextResponse.json(proposal, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/proposals:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/proposals - Get all proposals for the current user
 * Requires authentication
 */
export async function GET(req: Request) {
  // Get the query parameters for filtering
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const proposalType = url.searchParams.get("type");

  try {
    // Create a Supabase client
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    // Check if user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Start building the query
    let query = supabase.from("proposals").select("*").eq("user_id", user.id);

    // Add filters if provided
    if (status) {
      query = query.eq("status", status);
    }

    if (proposalType) {
      query = query.eq("proposal_type", proposalType);
    }

    // Execute the query
    const { data: proposals, error: queryError } = await query.order(
      "created_at",
      { ascending: false }
    );

    if (queryError) {
      console.error("Error fetching proposals:", queryError);
      return NextResponse.json(
        { message: "Failed to retrieve proposals" },
        { status: 500 }
      );
    }

    return NextResponse.json(proposals);
  } catch (error) {
    console.error("Error in GET /api/proposals:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
