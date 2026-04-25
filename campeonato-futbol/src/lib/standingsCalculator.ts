export type Standing = {
  teamId: string; teamName: string; teamLogo: string | null; pj: number; pg: number; pe: number; pp: number;
  gf: number; gc: number; dg: number; pts: number;
};

export function calculateStandings(
  teams: { id: string; name: string; logo_url?: string | null }[],
  matches: { home_team_id: string; away_team_id: string; home_goals: number | null; away_goals: number | null; is_played: boolean }[]
): Standing[] {
  const map = new Map<string, Standing>();
  teams.forEach(t => map.set(t.id, { teamId: t.id, teamName: t.name, teamLogo: t.logo_url || null, pj:0, pg:0, pe:0, pp:0, gf:0, gc:0, dg:0, pts:0 }));

  matches.filter(m => m.is_played).forEach(m => {
    if (m.home_goals === null || m.away_goals === null || !map.has(m.home_team_id) || !map.has(m.away_team_id)) return;
    const home = map.get(m.home_team_id)!; const away = map.get(m.away_team_id)!;
    home.pj++; away.pj++; home.gf += m.home_goals; home.gc += m.away_goals; away.gf += m.away_goals; away.gc += m.home_goals;
    if (m.home_goals > m.away_goals) { home.pg++; home.pts += 3; away.pp++; }
    else if (m.home_goals < m.away_goals) { away.pg++; away.pts += 3; home.pp++; }
    else { home.pe++; home.pts += 1; away.pe++; away.pts += 1; }
  });

  return Array.from(map.values()).map(s => ({...s, dg: s.gf - s.gc})).sort((a,b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf);
}
