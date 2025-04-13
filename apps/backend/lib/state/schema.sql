-- Create proposal_checkpoints table for storing LangGraph checkpoints
create table if not exists proposal_checkpoints (
  id bigint primary key generated always as identity,
  thread_id text unique not null,
  checkpoint_data jsonb not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Create proposal_sessions table for tracking session metadata
create table if not exists proposal_sessions (
  id bigint primary key generated always as identity,
  thread_id text unique not null references proposal_checkpoints(thread_id) on delete cascade,
  proposal_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamp with time zone default now() not null,
  last_active timestamp with time zone default now() not null,
  status text not null,
  metadata jsonb default '{}'::jsonb not null
);

-- Create indexes for performance
create index if not exists proposal_checkpoints_thread_id_idx on proposal_checkpoints(thread_id);
create index if not exists proposal_sessions_user_id_idx on proposal_sessions(user_id);
create index if not exists proposal_sessions_proposal_id_idx on proposal_sessions(proposal_id);
create index if not exists proposal_sessions_status_idx on proposal_sessions(status);
create index if not exists proposal_sessions_last_active_idx on proposal_sessions(last_active);

-- Set up Row Level Security
alter table proposal_checkpoints enable row level security;
alter table proposal_sessions enable row level security;

-- Create policies for proposal_checkpoints
create policy "Users can view their own checkpoints"
on proposal_checkpoints for select
using (
  auth.uid() in (
    select user_id from proposal_sessions
    where proposal_sessions.thread_id = proposal_checkpoints.thread_id
  )
);

create policy "Users can create their own checkpoints"
on proposal_checkpoints for insert
with check (
  auth.uid() in (
    select user_id from proposal_sessions
    where proposal_sessions.thread_id = proposal_checkpoints.thread_id
  )
);

create policy "Users can update their own checkpoints"
on proposal_checkpoints for update
using (
  auth.uid() in (
    select user_id from proposal_sessions
    where proposal_sessions.thread_id = proposal_checkpoints.thread_id
  )
);

create policy "Users can delete their own checkpoints"
on proposal_checkpoints for delete
using (
  auth.uid() in (
    select user_id from proposal_sessions
    where proposal_sessions.thread_id = proposal_checkpoints.thread_id
  )
);

-- Create policies for proposal_sessions
create policy "Users can view their own sessions"
on proposal_sessions for select
using (auth.uid() = user_id);

create policy "Users can create their own sessions"
on proposal_sessions for insert
with check (auth.uid() = user_id);

create policy "Users can update their own sessions"
on proposal_sessions for update
using (auth.uid() = user_id);

create policy "Users can delete their own sessions"
on proposal_sessions for delete
using (auth.uid() = user_id);

-- Function to clean up old sessions (run with a cron job)
create or replace function cleanup_old_sessions(days_threshold integer default 30)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  rows_deleted integer;
begin
  -- Delete sessions older than the threshold
  delete from proposal_sessions
  where last_active < now() - (days_threshold * interval '1 day');
  
  get diagnostics rows_deleted = row_count;
  return rows_deleted;
end;
$$;