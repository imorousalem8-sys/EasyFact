-- ==========================================================================
-- EASYFACT AFRICA - PRODUCTION SUPABASE DATABASE SCHEMA MIGRATION v2.0
-- Instructions :
-- 1. Ouvrez : https://supabase.com/dashboard/project/szjsxufiollglpsgzxqa/sql/new
-- 2. Collez ce script complet dans l'éditeur SQL
-- 3. Cliquez sur Run (bouton vert)
-- ==========================================================================

-- ============================================================
-- 1. Users & Companies Profile Table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  company_name TEXT NOT NULL DEFAULT 'Mon Entreprise SARL',
  ninea TEXT,
  phone TEXT,
  address TEXT,
  wave_num TEXT,
  om_num TEXT,
  bank_rib TEXT,
  tier TEXT NOT NULL DEFAULT 'starter',
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. OTP Verification Codes Table (remplace Map<> mémoire)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. CRM Clients Table
-- ============================================================
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

-- ============================================================
-- 4. Invoices Table
-- ============================================================
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
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 5. Expenses Table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount_ht NUMERIC(12,2) NOT NULL DEFAULT 0,
  method TEXT DEFAULT 'Wave / Caisse',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 6. Subscriptions & Mobile Money Payments Table (NOUVEAU v2.0)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL DEFAULT 'starter',
  status TEXT NOT NULL DEFAULT 'pending',
  payment_provider TEXT,
  payment_reference TEXT,
  payment_phone TEXT,
  amount_xof NUMERIC(12,2) NOT NULL DEFAULT 0,
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Enable Row Level Security (RLS)
-- ============================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Access Policies (Service Role Access via server-side API key)
-- ============================================================
CREATE POLICY "Allow full access for users" ON public.users FOR ALL USING (true);
CREATE POLICY "Allow full access for otp_codes" ON public.otp_codes FOR ALL USING (true);
CREATE POLICY "Allow full access for clients" ON public.clients FOR ALL USING (true);
CREATE POLICY "Allow full access for invoices" ON public.invoices FOR ALL USING (true);
CREATE POLICY "Allow full access for expenses" ON public.expenses FOR ALL USING (true);
CREATE POLICY "Allow full access for subscriptions" ON public.subscriptions FOR ALL USING (true);

-- ============================================================
-- Indexes for Performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_otp_codes_email ON public.otp_codes(email);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON public.expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);

-- ==========================================================================
-- FIN DU SCRIPT - Cliquez sur "Run" pour créer toutes les tables
-- Vérifiez dans : https://supabase.com/dashboard/project/szjsxufiollglpsgzxqa/editor
-- ==========================================================================
