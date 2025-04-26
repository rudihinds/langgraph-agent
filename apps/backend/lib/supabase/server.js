// Supabase server client stub
// This file is a mock for testing purposes
export const serverSupabase = {
  from: () => ({
    select: () => ({
      eq: () => ({
        eq: () => ({
          single: () => ({
            data: null,
            error: null,
          }),
        }),
      }),
    }),
  }),
};
