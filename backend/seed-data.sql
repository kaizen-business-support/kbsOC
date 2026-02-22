-- Seed data for Optimus Credit system
-- Clear existing data
DELETE FROM "audit_logs";
DELETE FROM "workflow_steps";
DELETE FROM "documents";
DELETE FROM "credit_applications";
DELETE FROM "financial_data";
DELETE FROM "clients";
DELETE FROM "users";

-- Insert users with hashed password (demo123 hashed with bcrypt rounds=12)
-- Password hash: $2b$12$LQv3c1yqBwEHXDx8RQZ8/uKg9z.9rSNhb4E9Z8.RQZ8/uKg9z.9rSN
INSERT INTO "users" ("id", "email", "password_hash", "name", "role", "department", "job_title", "permissions", "last_login") VALUES
('user1', 'amadou.diop@bank.sn', '$2b$12$LQv3c1yqBwEHXDx8RQZ8/uKg9z.9rSNhb4E9Z8.RQZ8/uKg9z.9rSN', 'Amadou Diop', 'account_manager', 'Commercial Dakar', 'Chargé d''Affaires Senior', '["create_client", "create_application", "view_applications", "edit_client_data"]'::jsonb, CURRENT_TIMESTAMP),
('user2', 'fatou.ndiaye@bank.sn', '$2b$12$LQv3c1yqBwEHXDx8RQZ8/uKg9z.9rSNhb4E9Z8.RQZ8/uKg9z.9rSN', 'Fatou Ndiaye', 'credit_analyst', 'Risques', 'Analyste Crédit Principal', '["review_applications", "financial_analysis", "score_applications", "benchmark_analysis"]'::jsonb, CURRENT_TIMESTAMP),
('user3', 'moussa.sarr@bank.sn', '$2b$12$LQv3c1yqBwEHXDx8RQZ8/uKg9z.9rSNhb4E9Z8.RQZ8/uKg9z.9rSN', 'Moussa Sarr', 'branch_manager', 'Direction Dakar Central', 'Directeur d''Agence', '["approve_applications", "view_portfolio", "manage_team", "workflow_override"]'::jsonb, CURRENT_TIMESTAMP),
('user4', 'comite@bank.sn', '$2b$12$LQv3c1yqBwEHXDx8RQZ8/uKg9z.9rSNhb4E9Z8.RQZ8/uKg9z.9rSN', 'Secrétariat Comité de Crédit', 'credit_committee', 'Comité', 'Secrétaire du Comité', '["committee_review", "final_approval", "risk_override", "policy_exceptions"]'::jsonb, CURRENT_TIMESTAMP),
('user5', 'direction@bank.sn', '$2b$12$LQv3c1yqBwEHXDx8RQZ8/uKg9z.9rSNhb4E9Z8.RQZ8/uKg9z.9rSN', 'Direction Générale', 'management', 'Direction Générale', 'Directeur Général', '["view_all", "portfolio_analytics", "risk_reporting", "policy_configuration", "user_management"]'::jsonb, CURRENT_TIMESTAMP),
('user6', 'admin@bank.sn', '$2b$12$LQv3c1yqBwEHXDx8RQZ8/uKg9z.9rSNhb4E9Z8.RQZ8/uKg9z.9rSN', 'Administrateur Système', 'admin', 'IT', 'Administrateur Principal', '["system_administration", "user_management", "role_assignment", "system_configuration", "audit_logs", "data_export"]'::jsonb, CURRENT_TIMESTAMP);

-- Insert clients
INSERT INTO "clients" ("id", "company_name", "rccm", "ninea", "cofi", "legal_form", "sector", "established_year", "headquarters", "contact_person", "phone", "email", "created_by") VALUES
('client1', 'Société Générale de Commerce', 'SN-DKR-2019-B-12345', '0062019012345', 'M082019123456789', 'SARL', 'Commerce', 2019, 'Dakar, Sénégal', 'Moussa Ba', '+221 77 123 4567', 'contact@sgc.sn', 'user1'),
('client2', 'Industries Textiles du Sahel', 'SN-DKR-2018-B-67890', '0062018067890', 'M082018678901234', 'SA', 'Industrie', 2018, 'Thiès, Sénégal', 'Fatou Diallo', '+221 77 234 5678', 'f.diallo@its.sn', 'user1'),
('client3', 'Transport et Logistique Express', 'SN-DKR-2020-B-11111', '0062020011111', 'M082020111112345', 'SARL', 'Transport', 2020, 'Pikine, Sénégal', 'Ibrahima Sarr', '+221 77 345 6789', 'i.sarr@tle.sn', 'user1');

-- Insert financial data for the first client (2022 and 2023)
INSERT INTO "financial_data" ("id", "client_id", "year", "period", "account_name", "account_value", "category") VALUES
-- 2022 data
('fd1', 'client1', 2022, 'annual', 'Chiffre d''affaires', 2500000.00, 'Income Statement'),
('fd2', 'client1', 2022, 'annual', 'Coût des ventes', 1800000.00, 'Income Statement'),
('fd3', 'client1', 2022, 'annual', 'Résultat brut', 700000.00, 'Income Statement'),
('fd4', 'client1', 2022, 'annual', 'Charges d''exploitation', 450000.00, 'Income Statement'),
('fd5', 'client1', 2022, 'annual', 'Résultat d''exploitation', 250000.00, 'Income Statement'),
('fd6', 'client1', 2022, 'annual', 'Résultat net', 180000.00, 'Income Statement'),
('fd7', 'client1', 2022, 'annual', 'Actif immobilisé', 800000.00, 'Balance Sheet'),
('fd8', 'client1', 2022, 'annual', 'Actif circulant', 1200000.00, 'Balance Sheet'),
('fd9', 'client1', 2022, 'annual', 'Trésorerie actif', 150000.00, 'Balance Sheet'),
('fd10', 'client1', 2022, 'annual', 'Capitaux propres', 900000.00, 'Balance Sheet'),
('fd11', 'client1', 2022, 'annual', 'Dettes long terme', 600000.00, 'Balance Sheet'),
('fd12', 'client1', 2022, 'annual', 'Dettes court terme', 650000.00, 'Balance Sheet'),
-- 2023 data
('fd13', 'client1', 2023, 'annual', 'Chiffre d''affaires', 2800000.00, 'Income Statement'),
('fd14', 'client1', 2023, 'annual', 'Coût des ventes', 2000000.00, 'Income Statement'),
('fd15', 'client1', 2023, 'annual', 'Résultat brut', 800000.00, 'Income Statement'),
('fd16', 'client1', 2023, 'annual', 'Charges d''exploitation', 480000.00, 'Income Statement'),
('fd17', 'client1', 2023, 'annual', 'Résultat d''exploitation', 320000.00, 'Income Statement'),
('fd18', 'client1', 2023, 'annual', 'Résultat net', 235000.00, 'Income Statement'),
('fd19', 'client1', 2023, 'annual', 'Actif immobilisé', 850000.00, 'Balance Sheet'),
('fd20', 'client1', 2023, 'annual', 'Actif circulant', 1350000.00, 'Balance Sheet'),
('fd21', 'client1', 2023, 'annual', 'Trésorerie actif', 200000.00, 'Balance Sheet'),
('fd22', 'client1', 2023, 'annual', 'Capitaux propres', 1100000.00, 'Balance Sheet'),
('fd23', 'client1', 2023, 'annual', 'Dettes long terme', 650000.00, 'Balance Sheet'),
('fd24', 'client1', 2023, 'annual', 'Dettes court terme', 650000.00, 'Balance Sheet');

-- Insert sample credit applications
INSERT INTO "credit_applications" ("id", "application_number", "client_id", "amount", "purpose", "duration_months", "proposed_rate", "collateral_type", "collateral_value", "repayment_schedule", "status", "score", "analysis_results", "submitted_at", "created_by") VALUES
('app1', 'APP-2024-001234', 'client1', 5000000.00, 'Financement du fonds de roulement pour extension des activités commerciales', 24, 12.5, 'Hypothèque commerciale', 8000000.00, 'monthly', 'submitted', 
'{"overall": 85, "profitability": 82, "liquidity": 78, "leverage": 75, "efficiency": 88, "trend": 85, "risk_level": "low"}'::jsonb,
'{"recommendations": ["Surveillance mensuelle de la trésorerie", "Diversification des sources de revenus recommandée", "Ratio d''endettement acceptable"], "strengths": ["Position de marché solide", "Équipe de direction expérimentée"], "weaknesses": ["Dépendance à quelques gros clients", "Saisonnalité des ventes"], "conclusion": "Dossier acceptable avec surveillance renforcée"}'::jsonb, 
CURRENT_TIMESTAMP, 'user1'),

('app2', 'APP-2024-001235', 'client2', 15000000.00, 'Acquisition de nouveaux équipements industriels', 36, 11.0, 'Nantissement équipement', 20000000.00, 'quarterly', 'under_review',
'{"overall": 78, "profitability": 75, "liquidity": 72, "leverage": 80, "efficiency": 85, "trend": 76, "risk_level": "medium"}'::jsonb,
'{"recommendations": ["Surveillance trimestrielle", "Amélioration des ratios de liquidité"], "strengths": ["Secteur porteur", "Équipements modernes"], "weaknesses": ["Besoin en fonds de roulement", "Concurrence intense"], "conclusion": "Dossier nécessitant un suivi rapproché"}'::jsonb,
CURRENT_TIMESTAMP - INTERVAL '5 days', 'user1'),

('app3', 'APP-2024-001236', 'client3', 3000000.00, 'Renouvellement de la flotte de véhicules de transport', 18, 13.0, 'Gage sur véhicules', 4500000.00, 'monthly', 'approved',
'{"overall": 90, "profitability": 88, "liquidity": 85, "leverage": 82, "efficiency": 92, "trend": 89, "risk_level": "low"}'::jsonb,
'{"recommendations": ["Suivi mensuel standard"], "strengths": ["Croissance soutenue", "Gestion rigoureuse"], "weaknesses": ["Dépendance au secteur transport"], "conclusion": "Dossier excellent - approbation recommandée"}'::jsonb,
CURRENT_TIMESTAMP - INTERVAL '10 days', 'user1');

-- Insert workflow steps
INSERT INTO "workflow_steps" ("id", "application_id", "step_name", "role", "assignee_id", "status", "deadline", "decision", "completed_at", "comments") VALUES
-- Workflow for app1 (submitted)
('ws1', 'app1', 'Review by credit analyst', 'credit_analyst', 'user2', 'pending', CURRENT_TIMESTAMP + INTERVAL '7 days', null, null, null),
('ws2', 'app1', 'Review by branch manager', 'branch_manager', 'user3', 'pending', CURRENT_TIMESTAMP + INTERVAL '7 days', null, null, null),
('ws3', 'app1', 'Review by credit committee', 'credit_committee', 'user4', 'pending', CURRENT_TIMESTAMP + INTERVAL '7 days', null, null, null),

-- Workflow for app2 (under review)
('ws4', 'app2', 'Review by credit analyst', 'credit_analyst', 'user2', 'completed', CURRENT_TIMESTAMP + INTERVAL '7 days', 'APPROVE', CURRENT_TIMESTAMP - INTERVAL '3 days', 'Reviewed and approved by Fatou Ndiaye'),
('ws5', 'app2', 'Review by branch manager', 'branch_manager', 'user3', 'pending', CURRENT_TIMESTAMP + INTERVAL '7 days', null, null, null),
('ws6', 'app2', 'Review by credit committee', 'credit_committee', 'user4', 'pending', CURRENT_TIMESTAMP + INTERVAL '7 days', null, null, null),

-- Workflow for app3 (approved)
('ws7', 'app3', 'Review by credit analyst', 'credit_analyst', 'user2', 'completed', CURRENT_TIMESTAMP + INTERVAL '7 days', 'APPROVE', CURRENT_TIMESTAMP - INTERVAL '8 days', 'Reviewed and approved by Fatou Ndiaye'),
('ws8', 'app3', 'Review by branch manager', 'branch_manager', 'user3', 'completed', CURRENT_TIMESTAMP + INTERVAL '7 days', 'APPROVE', CURRENT_TIMESTAMP - INTERVAL '6 days', 'Reviewed and approved by Moussa Sarr'),
('ws9', 'app3', 'Review by credit committee', 'credit_committee', 'user4', 'completed', CURRENT_TIMESTAMP + INTERVAL '7 days', 'APPROVE', CURRENT_TIMESTAMP - INTERVAL '4 days', 'Reviewed and approved by Secrétariat Comité de Crédit');

-- Insert audit logs
INSERT INTO "audit_logs" ("id", "user_id", "application_id", "action", "entity_type", "entity_id", "new_values", "ip_address", "user_agent") VALUES
('audit1', 'user1', 'app1', 'CREATE_APPLICATION', 'APPLICATION', 'app1', 
'{"amount": "5000000.00", "purpose": "Financement du fonds de roulement pour extension des activités commerciales", "status": "submitted"}'::jsonb, 
'192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'),

('audit2', 'user1', 'app2', 'CREATE_APPLICATION', 'APPLICATION', 'app2', 
'{"amount": "15000000.00", "purpose": "Acquisition de nouveaux équipements industriels", "status": "under_review"}'::jsonb, 
'192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'),

('audit3', 'user1', 'app3', 'CREATE_APPLICATION', 'APPLICATION', 'app3', 
'{"amount": "3000000.00", "purpose": "Renouvellement de la flotte de véhicules de transport", "status": "approved"}'::jsonb, 
'192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');