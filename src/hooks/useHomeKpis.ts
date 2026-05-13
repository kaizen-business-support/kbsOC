import { useEffect, useState } from 'react';
import { ApiService } from '../services/api';

type Kpi = Awaited<ReturnType<typeof ApiService.getHomeKpis>>['kpis'][number];

export function useHomeKpis(): { kpis: Kpi[] | null; loading: boolean; error: string | null } {
  const [kpis, setKpis] = useState<Kpi[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    ApiService.getHomeKpis()
      .then(res => { if (!cancelled) setKpis(res.kpis); })
      .catch(e => { if (!cancelled) setError(e?.response?.data?.error ?? 'Erreur de chargement'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { kpis, loading, error };
}
