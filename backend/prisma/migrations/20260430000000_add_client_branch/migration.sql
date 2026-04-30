-- Migration: ajouter le champ agence sur les clients

ALTER TABLE "clients" ADD COLUMN "branch" TEXT;
