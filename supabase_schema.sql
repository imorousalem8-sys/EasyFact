-- ==========================================================================
-- EASYFACT AFRICA - PRODUCTION SUPABASE DATABASE SCHEMA MIGRATION
-- Paste this script into your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/szjsxufiollglpsgzxqa/sql/new
-- ==========================================================================

-- 1. Users & Companies Profile Table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  company_name TEXT NOT NULL DEFAULT 'Mon Entreprise SARL',
  ninea TEXT,
  phone TEXT,
  address TEXT,
  wave_num TEXT,
  om_num TEXT,
  bank_rib TEXT,
  tier TEXT NOT NULL DEFAULT 'starter',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. CRM Clients Table
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  ninea TEXT,
  phone TEXT,
  email TEXT,
  city TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Invoices Table
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  client_name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Facture',
  status TEXT NOT NULL DEFAULT 'Payé',
  amount_ht NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_vat NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_withholding NUMERIC(12,2) NOT NULL DEFAULT 0,
  advance_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_to_pay NUMERIC(12,2) NOT NULL DEFAULT 0,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Expenses Table
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount_ht NUMERIC(12,2) NOT NULL DEFAULT 0,
  method TEXT DEFAULT 'Wave / Caisse',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Allow Public / Authenticated Access Policies for EasyFact API
CREATE POLICY "Allow full access for users" ON public.users FOR ALL USING (true);
CREATE POLICY "Allow full access for clients" ON public.clients FOR ALL USING (true);
CREATE POLICY "Allow full access for invoices" ON public.invoices FOR ALL USING (true);
CREATE POLICY "Allow full access for expenses" ON public.expenses FOR ALL USING (true);
