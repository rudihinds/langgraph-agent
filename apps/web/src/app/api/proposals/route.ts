import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { ProposalSchema } from "@/schemas/proposal";
import type { User } from "@supabase/supabase-js";
import { z } from "zod";

/**
 * Helper function to check authentication
 */
async function getAuthenticatedUser() {
  try {
    const cookieStore = cookies();
    console.log("Cookie count:", cookieStore.getAll().length);
    console.log(
      "Cookie names:",
      cookieStore
        .getAll()
        .map((c) => c.name)
        .join(", ")
    );

    const supabase = createClient(cookieStore);
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      console.error("Auth error:", error.message, error);
      return { user: null, error };
    }

    return { user: data.user, error: null };
  } catch (error) {
    console.error("Unexpected auth error:", error);
    return { user: null, error };
  }
}

/**
 * POST /api/proposals - Create a new proposal
 * Requires authentication
 */
export async function POST(req: Request) {
  try {
    console.log("POST /api/proposals - Request received");

    // Check authentication first
    const { user, error: authError } = await getAuthenticatedUser();
    if (!user) {
      console.log("Authentication failed:", authError);
      return NextResponse.json(
        {
          message: "Unauthorized",
          details: "You must be logged in to create a proposal",
        },
        { status: 401 }
      );
    }

    console.log("User authenticated:", user.id);

    // Parse the request body
    const body = await req.json();
    console.log("Proposal data received:", JSON.stringify(body, null, 2));

    // Validate the request body
    console.log("Validating proposal data...");
    const validationResult = ProposalSchema.safeParse(body);
    if (!validationResult.success) {
      console.log("Validation failed:", validationResult.error);
      return NextResponse.json(
        {
          message: "Invalid proposal data",
          errors: validationResult.error.format(),
        },
        { status: 400 }
      );
    }
    console.log("Validation successful");

    // Create a Supabase client
    console.log("Creating Supabase client for database operations...");
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    // Add user_id to the proposal data
    const proposalData = {
      ...validationResult.data,
      user_id: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    console.log("Final proposal data:", JSON.stringify(proposalData, null, 2));

    // Insert the proposal into the database
    console.log("Inserting proposal into database...");
    const { data: proposal, error } = await supabase
      .from("proposals")
      .insert(proposalData)
      .select()
      .single();

    if (error) {
      console.error("Error creating proposal:", error);
      return NextResponse.json(
        { message: "Failed to create proposal", error: error.message },
        { status: 500 }
      );
    }

    console.log("Proposal created successfully:", proposal.id);
    return NextResponse.json(proposal, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/proposals:", error);
    return NextResponse.json(
      { message: "Internal server error", error: String(error) },
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
    // Check authentication first
    const { user, error: authError } = await getAuthenticatedUser();
    if (!user) {
      console.log("Authentication failed for GET /api/proposals:", authError);
      return NextResponse.json(
        {
          message: "Unauthorized",
          details: "You must be logged in to view proposals",
        },
        { status: 401 }
      );
    }

    console.log("User authenticated for GET /api/proposals:", user.id);

    // Create a Supabase client
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

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
