-- Create enums
CREATE TYPE user_role AS ENUM (
    'account_manager',
    'credit_analyst',
    'branch_manager',
    'credit_committee',
    'management',
    'admin'
);

CREATE TYPE application_status AS ENUM (
    'draft',
    'submitted',
    'under_review',
    'approved',
    'rejected',
    'disbursed'
);

CREATE TYPE repayment_schedule AS ENUM (
    'monthly',
    'quarterly',
    'semiannual',
    'annual'
);

CREATE TYPE financial_period AS ENUM (
    'annual',
    'semester',
    'quarterly'
);

CREATE TYPE document_category AS ENUM (
    'financial',
    'legal',
    'identity',
    'collateral',
    'other'
);

CREATE TYPE document_status AS ENUM (
    'processing',
    'verified',
    'error',
    'pending'
);

CREATE TYPE step_status AS ENUM (
    'pending',
    'in_review',
    'approved',
    'rejected',
    'completed'
);

-- Create clients table
CREATE TABLE clients (
    id TEXT PRIMARY KEY,
    company_name TEXT NOT NULL,
    rccm TEXT UNIQUE,
    ninea TEXT UNIQUE,
    cofi TEXT,
    legal_form TEXT,
    sector TEXT,
    established_year INTEGER,
    headquarters TEXT,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Create credit_applications table
CREATE TABLE credit_applications (
    id TEXT PRIMARY KEY,
    application_number TEXT UNIQUE NOT NULL,
    client_id TEXT NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'XOF',
    purpose TEXT NOT NULL,
    duration_months INTEGER,
    proposed_rate DECIMAL(5,2),
    collateral_type TEXT,
    collateral_value DECIMAL(15,2),
    repayment_schedule repayment_schedule,
    status application_status NOT NULL DEFAULT 'draft',
    score JSONB,
    analysis_results JSONB,
    submitted_at TIMESTAMP,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Create financial_data table
CREATE TABLE financial_data (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    year INTEGER NOT NULL,
    period financial_period NOT NULL DEFAULT 'annual',
    account_name TEXT NOT NULL,
    account_value DECIMAL(15,2) NOT NULL,
    category TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    UNIQUE (client_id, year, period, account_name)
);

-- Create documents table
CREATE TABLE documents (
    id TEXT PRIMARY KEY,
    application_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    category document_category NOT NULL DEFAULT 'other',
    ocr_text TEXT,
    extracted_data JSONB,
    status document_status NOT NULL DEFAULT 'pending',
    uploaded_by TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY (application_id) REFERENCES credit_applications(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

-- Create workflow_steps table
CREATE TABLE workflow_steps (
    id TEXT PRIMARY KEY,
    application_id TEXT NOT NULL,
    step_name TEXT NOT NULL,
    role user_role NOT NULL,
    assignee_id TEXT,
    status step_status NOT NULL DEFAULT 'pending',
    deadline TIMESTAMP,
    comments TEXT,
    decision TEXT,
    completed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY (application_id) REFERENCES credit_applications(id) ON DELETE CASCADE,
    FOREIGN KEY (assignee_id) REFERENCES users(id)
);

-- Create audit_logs table
CREATE TABLE audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    application_id TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    old_values JSONB,
    new_values JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (application_id) REFERENCES credit_applications(id)
);