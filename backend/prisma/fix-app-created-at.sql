-- Correction définitive des createdAt pour les apps du seed initial
-- Table : credit_applications (@@map Prisma)
-- Référence : app1 a createdAt = seed_date - 2 jours → seed_date = app1.createdAt + 2 jours

WITH seed_date AS (
  SELECT "createdAt" + INTERVAL '2 days' AS sd
  FROM credit_applications
  WHERE id = 'app1'
)
UPDATE credit_applications AS a
SET "createdAt" = sd.sd - (
  CASE a.id
    WHEN 'app2'  THEN INTERVAL '5 days'
    WHEN 'app3'  THEN INTERVAL '10 days'
    WHEN 'app4'  THEN INTERVAL '16 days'
    WHEN 'app5'  THEN INTERVAL '18 days'
    WHEN 'app6'  THEN INTERVAL '22 days'
    WHEN 'app7'  THEN INTERVAL '23 days'
    WHEN 'app8'  THEN INTERVAL '29 days'
    WHEN 'app9'  THEN INTERVAL '32 days'
    WHEN 'app10' THEN INTERVAL '39 days'
    WHEN 'app11' THEN INTERVAL '46 days'
    WHEN 'app12' THEN INTERVAL '49 days'
    WHEN 'app13' THEN INTERVAL '52 days'
    WHEN 'app14' THEN INTERVAL '59 days'
    WHEN 'app15' THEN INTERVAL '64 days'
  END
)
FROM seed_date
WHERE a.id IN ('app2','app3','app4','app5','app6','app7','app8',
               'app9','app10','app11','app12','app13','app14','app15');

-- Vérification : doit retourner 0 ligne (aucune violation restante)
SELECT a.id, a."createdAt", min(ws."completedAt") AS first_step_completed
FROM credit_applications a
JOIN workflow_steps ws ON ws."applicationId" = a.id
WHERE ws."completedAt" IS NOT NULL
GROUP BY a.id, a."createdAt"
HAVING a."createdAt" > min(ws."completedAt");
