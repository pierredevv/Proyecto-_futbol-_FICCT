import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import { Trophy, CalendarDays, BarChart3, LayoutGrid } from "lucide-react";
import Link from "next/link";
import { calculateStandings } from "@/lib/standingsCalculator";

export default async function PublicTournamentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  
  const { data: tournament } = await supabase.from("tournaments").select("*").eq("slug", slug).single();
  if (!tournament) notFound();

  const { data: teams } = await supabase.from("teams").select("*").eq("tournament_id", tournament.id).order('created_at', { ascending: true });
  const { data: matches } = await supabase.from("matches").select("*").eq("tournament_id", tournament.id).order('created_at', { ascending: true });

  const teamsList = teams || [];
  const matchesList = matches || [];
  const getTeam = (id: string) => teamsList.find(t => t.id === id);

  // Funciones de ayuda
  const isEliminatoria = tournament.format === 'eliminacion';
  const isGrupos = tournament.format === 'grupos';

  // Si es grupos, separamos las posiciones por grupo según los partidos jugados
  let groupStandings: { groupName: string; standings: any[] }[] = [];
  let generalStandings: any[] = [];

  if (isGrupos) {
    const groupNames = Array.from(new Set(matchesList.map(m => m.round.split(' - ')[0]).filter(r => r.startsWith('Grupo'))));
    groupNames.forEach(g => {
      // Filtrar partidos del grupo
      const gMatches = matchesList.filter(m => m.round.startsWith(g));
      // Obtener IDs de equipos en este grupo
      const gTeamIds = new Set<string>();
      gMatches.forEach(m => { gTeamIds.add(m.home_team_id); gTeamIds.add(m.away_team_id); });
      const gTeams = teamsList.filter(t => gTeamIds.has(t.id));
      groupStandings.push({
        groupName: g,
        standings: calculateStandings(gTeams, gMatches)
      });
    });
    groupStandings.sort((a,b) => a.groupName.localeCompare(b.groupName));
  } else if (!isEliminatoria) {
    generalStandings = calculateStandings(teamsList, matchesList);
  }

  // Bracket format para eliminatoria
  const getStageOrder = (round: string) => {
    const r = round.toLowerCase();
    if (r.includes("final")) return 4;
    if (r.includes("semi")) return 3;
    if (r.includes("cuarto")) return 2;
    if (r.includes("octavo")) return 1;
    return 0;
  };
  const knockoutRounds = Array.from(new Set(matchesList.map(m => m.round))).sort((a,b) => getStageOrder(a) - getStageOrder(b));

  // Render de Tabla NWSL Style
  const renderStandingsTable = (standings: any[]) => (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
        <div className="w-8 md:w-12 text-center">Pos</div>
        <div className="flex-1">Equipo</div>
        <div className="w-8 text-center hidden sm:block">PJ</div>
        <div className="w-8 text-center hidden sm:block">PG</div>
        <div className="w-8 text-center hidden sm:block">PE</div>
        <div className="w-8 text-center hidden sm:block">PP</div>
        <div className="w-10 text-center">DG</div>
        <div className="w-12 text-center font-black text-gray-500">PTS</div>
      </div>

      {standings.length === 0 ? (
        <div className="bg-white/90 backdrop-blur rounded-2xl p-8 text-center text-gray-500">No hay datos suficientes.</div>
      ) : (
        standings.map((row, index) => {
          const isTop = index < 4;
          return (
            <div key={index} className={`flex items-center px-4 py-3 bg-white rounded-2xl shadow-sm hover:shadow-md hover:scale-[1.01] transition-all ${isTop ? 'border-l-4 border-l-blue-500' : ''}`}>
              <div className="w-8 md:w-12 text-center font-black text-xl text-gray-800">{index + 1}</div>
              
              <div className="flex-1">
                <Link href={`/c/${tournament.slug}/equipo/${row.teamId}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                  {row.teamLogo ? (
                    <img src={row.teamLogo} alt={row.teamName} className="w-10 h-10 rounded-full object-cover border border-gray-100 shadow-sm" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center font-black text-sm shadow-sm">
                      {row.teamName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="font-bold text-gray-900 text-sm sm:text-base line-clamp-1">{row.teamName.toUpperCase()}</span>
                </Link>
              </div>

              <div className="w-8 text-center font-semibold text-gray-500 hidden sm:block">{row.pj}</div>
              <div className="w-8 text-center font-semibold text-gray-500 hidden sm:block">{row.pg}</div>
              <div className="w-8 text-center font-semibold text-gray-500 hidden sm:block">{row.pe}</div>
              <div className="w-8 text-center font-semibold text-gray-500 hidden sm:block">{row.pp}</div>
              <div className="w-10 text-center font-bold text-gray-700">{row.dg > 0 ? `+${row.dg}` : row.dg}</div>
              <div className="w-12 text-center font-black text-2xl text-blue-700">{row.pts}</div>
            </div>
          );
        })
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0f25] via-[#1a2355] to-[#2d1b6e] pb-20">
      {/* Header Público Estilo NWSL */}
      <header className="pt-16 pb-12 px-4 sm:px-6 lg:px-8 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none"></div>
        <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center">
          <div className="flex items-center gap-3 mb-6">
            <Trophy className="w-10 h-10 text-white drop-shadow-lg" />
            <span className="text-white font-bold tracking-[0.2em] text-sm uppercase opacity-90">FICCT Oficial</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-gray-300 uppercase tracking-tight drop-shadow-sm text-center">
            {tournament.name}
          </h1>
          <p className="mt-4 text-blue-200/80 font-medium tracking-widest uppercase text-sm">
            Road to the Championship
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 space-y-16">
        
        {/* Tabla de Posiciones */}
        {!isEliminatoria && (
          <section className="relative z-10">
            {isGrupos ? (
              <div className="space-y-12">
                {groupStandings.map(g => (
                  <div key={g.groupName}>
                    <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-6 px-2">{g.groupName}</h2>
                    {renderStandingsTable(g.standings)}
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-6 px-2">Tabla de Posiciones</h2>
                {renderStandingsTable(generalStandings)}
              </div>
            )}
          </section>
        )}

        {/* Calendario y Fixture */}
        <section>
          <div className="flex items-center gap-3 mb-8 px-2">
            <CalendarDays className="w-6 h-6 text-yellow-400" />
            <h2 className="text-2xl font-black text-white uppercase tracking-widest">Fixture y Resultados</h2>
          </div>

          {matchesList.length === 0 ? (
            <div className="bg-white/10 backdrop-blur rounded-3xl p-10 text-center border border-white/10">
              <p className="text-blue-200 font-medium tracking-wider">El fixture aún no ha sido generado.</p>
            </div>
          ) : isEliminatoria ? (
            // Bracket View
            <div className="flex flex-col md:flex-row gap-6 md:gap-8 overflow-x-auto pb-8 snap-x">
              {knockoutRounds.map(round => (
                <div key={round} className="flex flex-col gap-6 min-w-[300px] snap-center">
                  <h3 className="text-sm font-black text-yellow-400 uppercase tracking-[0.2em] text-center bg-black/20 py-2 rounded-lg backdrop-blur">{round}</h3>
                  <div className="flex flex-col gap-4 justify-center h-full">
                    {matchesList.filter(m => m.round === round).map(match => {
                      const homeTeam = getTeam(match.home_team_id);
                      const awayTeam = getTeam(match.away_team_id);
                      if (!homeTeam || !awayTeam) return null;
                      return (
                        <div key={match.id} className="bg-white/95 backdrop-blur rounded-2xl shadow-xl overflow-hidden border border-white/20">
                          {match.match_date && (
                            <div className="bg-blue-600 text-white text-[10px] font-bold text-center py-1.5 uppercase tracking-widest">
                              {new Date(match.match_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} {match.match_time ? `| ${match.match_time}` : ''}
                            </div>
                          )}
                          <div className="p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {homeTeam.logo_url ? <img src={homeTeam.logo_url} className="w-6 h-6 rounded-full object-cover" /> : <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold">{homeTeam.name.charAt(0)}</div>}
                                <span className={`text-sm font-bold ${match.is_played && match.home_goals! > match.away_goals! ? 'text-blue-700' : 'text-gray-700'} line-clamp-1`}>{homeTeam.name}</span>
                              </div>
                              <span className="font-black text-lg text-gray-900">{match.is_played ? match.home_goals : '-'}</span>
                            </div>
                            <div className="h-[1px] bg-gray-100"></div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {awayTeam.logo_url ? <img src={awayTeam.logo_url} className="w-6 h-6 rounded-full object-cover" /> : <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold">{awayTeam.name.charAt(0)}</div>}
                                <span className={`text-sm font-bold ${match.is_played && match.away_goals! > match.home_goals! ? 'text-blue-700' : 'text-gray-700'} line-clamp-1`}>{awayTeam.name}</span>
                              </div>
                              <span className="font-black text-lg text-gray-900">{match.is_played ? match.away_goals : '-'}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Lista normal de fixture (Cards)
            <div className="space-y-12">
              {Array.from(new Set(matchesList.map(m => m.round))).map(round => (
                <div key={round} className="space-y-4">
                  <h3 className="text-sm font-black text-yellow-400 uppercase tracking-[0.2em]">{round}</h3>
                  <div className="space-y-4">
                    {matchesList.filter(m => m.round === round).map(match => {
                      const homeTeam = getTeam(match.home_team_id);
                      const awayTeam = getTeam(match.away_team_id);
                      if (!homeTeam || !awayTeam) return null;

                      let dateStr = 'TBD';
                      if (match.match_date) {
                        const d = new Date(match.match_date + "T12:00:00");
                        dateStr = d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }).toUpperCase();
                      }

                      return (
                        <div key={match.id} className="flex flex-col md:flex-row items-center justify-between bg-white/95 backdrop-blur shadow-xl rounded-2xl p-4 hover:scale-[1.01] transition-transform">
                          <div className="flex items-center gap-4 w-full md:w-[60%] justify-center md:justify-start mb-4 md:mb-0">
                            <Link href={`/c/${tournament.slug}/equipo/${match.home_team_id}`} className="flex flex-col items-center hover:opacity-80 transition-opacity w-24">
                              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-md border border-gray-100 overflow-hidden mb-2">
                                {homeTeam.logo_url ? <img src={homeTeam.logo_url} className="w-full h-full object-cover" /> : <span className="text-xl font-black text-gray-300">{homeTeam.name.charAt(0)}</span>}
                              </div>
                              <span className="font-black text-gray-800 text-xs text-center uppercase tracking-wide line-clamp-1">{homeTeam.name}</span>
                            </Link>
                            
                            <div className="flex flex-col items-center min-w-[80px]">
                              {match.is_played ? (
                                <div className="text-3xl font-black text-gray-900 tracking-widest drop-shadow-sm">
                                  {match.home_goals} - {match.away_goals}
                                </div>
                              ) : (
                                <div className="text-xs font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest border border-blue-100">VS</div>
                              )}
                            </div>
                            
                            <Link href={`/c/${tournament.slug}/equipo/${match.away_team_id}`} className="flex flex-col items-center hover:opacity-80 transition-opacity w-24">
                              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-md border border-gray-100 overflow-hidden mb-2">
                                {awayTeam.logo_url ? <img src={awayTeam.logo_url} className="w-full h-full object-cover" /> : <span className="text-xl font-black text-gray-300">{awayTeam.name.charAt(0)}</span>}
                              </div>
                              <span className="font-black text-gray-800 text-xs text-center uppercase tracking-wide line-clamp-1">{awayTeam.name}</span>
                            </Link>
                          </div>

                          <div className="flex flex-col items-center md:items-end w-full md:w-[40%]">
                            <div className="bg-blue-600 text-white font-black px-6 py-2 rounded-xl text-sm tracking-widest uppercase mb-2 shadow-md">
                              {dateStr}
                            </div>
                            <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest">
                              <span>{match.match_time ? `${match.match_time} H` : 'Hora TBD'}</span>
                              <span className="text-gray-300">|</span>
                              <span className="truncate max-w-[150px]">{match.location || 'Cancha TBD'}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
