-- Skema database Supabase untuk QR Inspektorat.
-- Jalankan di Supabase SQL Editor sebagai satu script.

create extension if not exists "pgcrypto";

-- Profil tambahan pengguna. Password tetap dikelola Supabase Auth.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username varchar(100) not null default '',
  date_of_birth date,
  field varchar(150) not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Data produk yang digunakan ProductList.
create table if not exists public.products (
  id varchar(36) primary key,
  name varchar(255) not null,
  location varchar(255) not null,
  quantity integer not null default 0 check (quantity >= 0),
  image text,
  timestamp bigint not null,
  created_at timestamptz not null default now()
);

-- Riwayat aktivitas agar fitur History dapat dikembangkan.
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action varchar(30) not null check (action in ('add', 'download_qr', 'delete', 'update')),
  product_id varchar(36) references public.products(id) on delete set null,
  product_name varchar(255),
  created_at timestamptz not null default now()
);

create index if not exists idx_products_name on public.products(name);
create index if not exists idx_products_location on public.products(location);
create index if not exists idx_products_timestamp on public.products(timestamp desc);
create index if not exists idx_activity_logs_user on public.activity_logs(user_id, created_at desc);

-- Membuat profil otomatis setelah akun Supabase Auth dibuat.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, date_of_birth, field)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', ''),
    nullif(new.raw_user_meta_data ->> 'dateOfBirth', '')::date,
    coalesce(new.raw_user_meta_data ->> 'field', '')
  )
  on conflict (id) do update set
    username = excluded.username,
    date_of_birth = excluded.date_of_birth,
    field = excluded.field,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.activity_logs enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Produk saat ini dikelola oleh pengguna yang sudah login.
drop policy if exists "Authenticated users can read products" on public.products;
create policy "Authenticated users can read products"
  on public.products for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can add products" on public.products;
create policy "Authenticated users can add products"
  on public.products for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update products" on public.products;
create policy "Authenticated users can update products"
  on public.products for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can delete products" on public.products;
create policy "Authenticated users can delete products"
  on public.products for delete
  to authenticated
  using (true);

drop policy if exists "Users can read activity history" on public.activity_logs;
create policy "Users can read activity history"
  on public.activity_logs for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can add activity history" on public.activity_logs;
create policy "Users can add activity history"
  on public.activity_logs for insert
  to authenticated
  with check (user_id = auth.uid());
