-- Migration : ajouter la valeur 'creation' à l'enum policy_step_type
-- Représente le point de départ du workflow : création du dossier par le CA

ALTER TYPE "policy_step_type" ADD VALUE IF NOT EXISTS 'creation';
