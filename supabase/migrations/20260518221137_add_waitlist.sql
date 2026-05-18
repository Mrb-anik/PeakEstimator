-- Waitlist table for capturing pre-launch interest
create table if not exists waitlist (
  id uuid default gen_random_uuid() primary key,
  email text not null unique,
  name text,
  trade text,
  company text,
  created_at timestamptz default now()
);

-- Anyone can insert (public waitlist signup)
alter table waitlist enable row level security;
create policy "Public waitlist insert" on waitlist for insert with check (true);
-- Only authenticated users (admins) can read waitlist
create policy "Auth read waitlist" on waitlist for select using (auth.uid() is not null);
