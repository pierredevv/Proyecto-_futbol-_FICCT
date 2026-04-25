"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Users, CalendarDays, Hash, Plus, Trash2, Save, LayoutGrid, Loader2, ImagePlus, UserPlus } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { generateLeagueFixture, generateKnockoutFixture, generateGroupsFixture } from "@/lib/fixtureGenerator";

type Tournament = any;
type Team = { id: string; tournament_id: string; name: string; logo_url: string | null };
type Player = { id: string; team_id: string; name: string; number: number | null; position: string | null };
type Match = { 
  id: string; 
  home_team_id: string; 
  away_team_id: string; 
  round: string; 
  home_goals: number | null; 
  away_goals: number | null; 
  is_played: boolean;
  match_date: string | null;
  match_time: string | null;
  location: string | null;
};

export default function AdminPanelClient({ tournament }: { tournament: Tournament }) {
  const [activeTab, setActiveTab] = useState<"equipos" | "jugadores" | "fixture" | "resultados">("equipos");
  const supabase = createClient();

  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  // States para Formularios
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamLogoFile, setNewTeamLogoFile] = useState<File | null>(null);
  const [addingTeam, setAddingTeam] = useState(false);
  const [generatingFixture, setGeneratingFixture] = useState(false);
  const [savingMatches, setSavingMatches] = useState<Record<string, boolean>>({});

  // States para Jugadores
  const [selectedTeamIdForPlayers, setSelectedTeamIdForPlayers] = useState<string>("");
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerNumber, setNewPlayerNumber] = useState("");
  const [newPlayerPosition, setNewPlayerPosition] = useState("");
  const [addingPlayer, setAddingPlayer] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const [teamsRes, matchesRes] = await Promise.all([
        supabase.from("teams").select("*").eq("tournament_id", tournament.id).order('created_at', { ascending: true }),
        supabase.from("matches").select("*").eq("tournament_id", tournament.id).order('created_at', { ascending: true })
      ]);
      
      if (teamsRes.data) {
        setTeams(teamsRes.data);
        if (teamsRes.data.length > 0) {
          setSelectedTeamIdForPlayers(teamsRes.data[0].id);
        }
      }
      if (matchesRes.data) setMatches(matchesRes.data);
      setLoading(false);
    }
    loadData();
  }, [tournament.id, supabase]);

  useEffect(() => {
    async function loadPlayers() {
      if (!selectedTeamIdForPlayers) return;
      const { data } = await supabase.from("players").select("*").eq("team_id", selectedTeamIdForPlayers).order('created_at', { ascending: true });
      if (data) setPlayers(data);
    }
    loadPlayers();
  }, [selectedTeamIdForPlayers, supabase]);

  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newTeamName.trim() === "") return;
    setAddingTeam(true);

    let logo_url = null;

    if (newTeamLogoFile) {
      const fileExt = newTeamLogoFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('tournaments_media')
        .upload(`logos/${fileName}`, newTeamLogoFile);

      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage.from('tournaments_media').getPublicUrl(`logos/${fileName}`);
        logo_url = publicUrl;
      }
    }

    const { data, error } = await supabase.from("teams").insert({
      tournament_id: tournament.id,
      name: newTeamName.trim(),
      logo_url
    }).select().single();

    if (data) {
      setTeams([...teams, data]);
      if (!selectedTeamIdForPlayers) setSelectedTeamIdForPlayers(data.id);
      setNewTeamName("");
      setNewTeamLogoFile(null);
    } else {
      alert("Error al agregar equipo");
    }
    setAddingTeam(false);
  };

  const handleRemoveTeam = async (id: string) => {
    if (!confirm("¿Seguro que deseas eliminar este equipo?")) return;
    const { error } = await supabase.from("teams").delete().eq("id", id);
    if (!error) {
      setTeams(teams.filter((t) => t.id !== id));
      setMatches(matches.filter((m) => m.home_team_id !== id && m.away_team_id !== id));
      if (selectedTeamIdForPlayers === id) {
        setSelectedTeamIdForPlayers(teams.filter((t) => t.id !== id)[0]?.id || "");
      }
    }
  };

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPlayerName.trim() === "" || !selectedTeamIdForPlayers) return;
    setAddingPlayer(true);

    const { data, error } = await supabase.from("players").insert({
      team_id: selectedTeamIdForPlayers,
      name: newPlayerName.trim(),
      number: newPlayerNumber ? parseInt(newPlayerNumber) : null,
      position: newPlayerPosition.trim() || null
    }).select().single();

    if (data) {
      setPlayers([...players, data]);
      setNewPlayerName("");
      setNewPlayerNumber("");
      setNewPlayerPosition("");
    } else {
      alert("Error al agregar jugador");
    }
    setAddingPlayer(false);
  };

  const handleRemovePlayer = async (id: string) => {
    if (!confirm("¿Seguro que deseas eliminar este jugador?")) return;
    const { error } = await supabase.from("players").delete().eq("id", id);
    if (!error) {
      setPlayers(players.filter((p) => p.id !== id));
    }
  };

  const handleGenerateFixture = async () => {
    if (teams.length < 2) return alert("Se necesitan al menos 2 equipos para generar un fixture.");
    if (matches.length > 0) {
      if (!confirm("Ya existe un fixture. ¿Deseas sobreescribirlo y borrar los resultados actuales?")) return;
    }
    
    setGeneratingFixture(true);

    // Borrar partidos existentes en DB
    await supabase.from("matches").delete().eq("tournament_id", tournament.id);

    const teamIds = teams.map(t => t.id);
    let generatedMatches: any[] = [];

    if (tournament.format === 'liga') {
      generatedMatches = generateLeagueFixture(teamIds);
    } else if (tournament.format === 'eliminacion') {
      generatedMatches = generateKnockoutFixture(teamIds);
    } else {
      generatedMatches = generateGroupsFixture(teamIds);
    }

    const payload = generatedMatches.filter(m => m.home_team_id !== m.away_team_id).map(m => ({
      tournament_id: tournament.id,
      home_team_id: m.home_team_id,
      away_team_id: m.away_team_id,
      round: m.round
    }));

    if (payload.length > 0) {
      const { data, error } = await supabase.from("matches").insert(payload).select();
      if (data) setMatches(data);
    }

    if (tournament.status === 'draft') {
      await supabase.from("tournaments").update({ status: 'active' }).eq('id', tournament.id);
    }

    setGeneratingFixture(false);
    alert("Fixture generado correctamente");
  };

  const handleMatchChange = (matchId: string, field: keyof Match, value: any) => {
    setMatches(matches.map(m => m.id === matchId ? { ...m, [field]: value } : m));
  };

  const handleSaveMatch = async (matchId: string) => {
    setSavingMatches(prev => ({...prev, [matchId]: true}));
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    const payload = {
      home_goals: match.home_goals === null || String(match.home_goals) === "" ? null : Number(match.home_goals),
      away_goals: match.away_goals === null || String(match.away_goals) === "" ? null : Number(match.away_goals),
      is_played: true,
      match_date: match.match_date || null,
      match_time: match.match_time || null,
      location: match.location || null,
    };

    const { data, error } = await supabase.from("matches").update(payload).eq("id", matchId).select().single();
    
    if (data) {
      setMatches(matches.map(m => m.id === matchId ? data : m));
    } else {
      alert("Error al guardar el partido");
    }
    
    setSavingMatches(prev => ({...prev, [matchId]: false}));
  };

  const getTeamName = (id: string) => teams.find(t => t.id === id)?.name || "Equipo Desconocido";

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="mb-4">
            <Link href="/dashboard" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Volver al Dashboard
            </Link>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900">{tournament.name}</h1>
              <p className="text-sm text-gray-500 mt-1">Administración del torneo ({tournament.format})</p>
            </div>
            <Link 
              href={`/c/${tournament.slug}`}
              className="inline-flex items-center gap-2 text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 px-4 py-2 rounded-lg transition-colors"
            >
              <LayoutGrid className="w-4 h-4" />
              Ver Vista Pública
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8 overflow-x-auto" aria-label="Tabs">
            {[
              { id: "equipos", name: "Equipos", icon: Users },
              { id: "jugadores", name: "Jugadores", icon: UserPlus },
              { id: "fixture", name: "Fixture", icon: CalendarDays },
              { id: "resultados", name: "Resultados", icon: Hash },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`
                    flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors
                    ${isActive 
                      ? "border-blue-500 text-blue-600" 
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }
                  `}
                >
                  <Icon className={`w-5 h-5 ${isActive ? "text-blue-500" : "text-gray-400"}`} />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        
        {/* EQUIPOS TAB */}
        {activeTab === "equipos" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Agregar Nuevo Equipo</h2>
              <form onSubmit={handleAddTeam} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Nombre del equipo..."
                  className="flex-1 bg-gray-50 border border-gray-200 text-gray-900 rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none transition-all"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  required
                />
                <div className="relative flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    id="logo-upload"
                    className="hidden"
                    onChange={(e) => setNewTeamLogoFile(e.target.files?.[0] || null)}
                  />
                  <label 
                    htmlFor="logo-upload" 
                    className="flex items-center justify-center gap-2 bg-gray-50 border border-gray-200 text-gray-600 rounded-lg focus-within:ring-blue-500 focus-within:border-blue-500 block w-full p-2.5 outline-none transition-all cursor-pointer hover:bg-gray-100"
                  >
                    <ImagePlus className="w-5 h-5 text-gray-400" />
                    <span className="truncate">{newTeamLogoFile ? newTeamLogoFile.name : "Subir Logo (Opcional)..."}</span>
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={addingTeam}
                  className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-lg transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-sm disabled:opacity-50"
                >
                  {addingTeam ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                  Agregar
                </button>
              </form>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800">Equipos Registrados ({teams.length})</h2>
              </div>
              {teams.length === 0 ? (
                <p className="text-gray-500 text-center py-6">No hay equipos registrados aún.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {teams.map((team) => (
                    <div key={team.id} className="flex items-center justify-between bg-gray-50 border border-gray-200 text-gray-800 p-3 rounded-xl font-medium text-sm">
                      <div className="flex items-center gap-3 overflow-hidden">
                        {team.logo_url ? (
                          <img src={team.logo_url} alt={team.name} className="w-8 h-8 rounded-full object-cover border border-gray-200 bg-white" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs border border-blue-200">
                            {team.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="truncate">{team.name}</span>
                      </div>
                      <button 
                        onClick={() => handleRemoveTeam(team.id)}
                        className="text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg p-1.5 transition-colors shrink-0"
                        title="Eliminar equipo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* JUGADORES TAB */}
        {activeTab === "jugadores" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Gestión de Jugadores</h2>
              
              {teams.length === 0 ? (
                <p className="text-gray-500 text-center py-6">Registra al menos un equipo primero.</p>
              ) : (
                <div className="space-y-6">
                  {/* Selector de Equipo */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Seleccionar Equipo</label>
                    <select
                      className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-3 outline-none transition-all"
                      value={selectedTeamIdForPlayers}
                      onChange={(e) => setSelectedTeamIdForPlayers(e.target.value)}
                    >
                      {teams.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Formulario de Nuevo Jugador */}
                  <form onSubmit={handleAddPlayer} className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-100">
                    <input
                      type="text"
                      placeholder="Nombre del jugador..."
                      className="flex-[2] bg-gray-50 border border-gray-200 text-gray-900 rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none transition-all"
                      value={newPlayerName}
                      onChange={(e) => setNewPlayerName(e.target.value)}
                      required
                    />
                    <input
                      type="number"
                      placeholder="Número (Ej: 10)"
                      className="flex-1 bg-gray-50 border border-gray-200 text-gray-900 rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none transition-all"
                      value={newPlayerNumber}
                      onChange={(e) => setNewPlayerNumber(e.target.value)}
                    />
                    <select
                      className="flex-1 bg-gray-50 border border-gray-200 text-gray-900 rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none transition-all"
                      value={newPlayerPosition}
                      onChange={(e) => setNewPlayerPosition(e.target.value)}
                    >
                      <option value="">Posición...</option>
                      <option value="POR">Portero</option>
                      <option value="DEF">Defensa</option>
                      <option value="MED">Mediocampista</option>
                      <option value="DEL">Delantero</option>
                    </select>
                    <button
                      type="submit"
                      disabled={addingPlayer}
                      className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-lg transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-sm disabled:opacity-50"
                    >
                      {addingPlayer ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                      Añadir
                    </button>
                  </form>

                  {/* Lista de Jugadores */}
                  <div className="pt-4">
                    <h3 className="text-sm font-bold text-gray-800 mb-3">Plantilla Registrada ({players.length})</h3>
                    {players.length === 0 ? (
                      <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-sm text-gray-500">
                        No hay jugadores registrados en este equipo.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {players.map((player) => (
                          <div key={player.id} className="flex items-center justify-between bg-white border border-gray-200 text-gray-800 p-3 rounded-xl font-medium text-sm shadow-sm hover:border-blue-200 transition-colors">
                            <div className="flex items-center gap-3 overflow-hidden">
                              <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-gray-500 font-black text-sm border border-gray-200 shrink-0">
                                {player.number || "-"}
                              </div>
                              <div className="flex flex-col">
                                <span className="truncate font-bold text-gray-900">{player.name}</span>
                                <span className="text-xs text-gray-500 uppercase">{player.position || "Sin Posición"}</span>
                              </div>
                            </div>
                            <button 
                              onClick={() => handleRemovePlayer(player.id)}
                              className="text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg p-1.5 transition-colors shrink-0"
                              title="Eliminar jugador"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* FIXTURE TAB */}
        {activeTab === "fixture" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Fixture del Campeonato</h2>
                <p className="text-sm text-gray-500">Genera los partidos automáticamente basados en los equipos inscritos.</p>
              </div>
              <button 
                onClick={handleGenerateFixture}
                disabled={generatingFixture}
                className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-xl shadow-sm transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {generatingFixture ? <Loader2 className="w-5 h-5 animate-spin" /> : <CalendarDays className="w-5 h-5" />}
                Generar Fixture Automático
              </button>
            </div>

            <div className="space-y-6">
              {matches.length === 0 ? (
                <div className="text-center py-10 bg-white rounded-xl border border-gray-100 text-gray-500">
                  Aún no hay partidos generados.
                </div>
              ) : (
                Array.from(new Set(matches.map(m => m.round))).map(round => (
                  <div key={round} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="bg-gray-50 px-6 py-3 border-b border-gray-100">
                      <h3 className="font-bold text-gray-800">{round}</h3>
                    </div>
                    <ul className="divide-y divide-gray-100">
                      {matches.filter(m => m.round === round).map(match => (
                        <li key={match.id} className="px-6 py-4 flex flex-col sm:flex-row items-center justify-between hover:bg-gray-50/50 transition-colors gap-2">
                          <div className="flex-1 text-right font-medium text-gray-800 sm:pr-4 w-full sm:w-auto">{getTeamName(match.home_team_id)}</div>
                          <div className="px-4 py-1 rounded bg-gray-100 text-gray-500 text-sm font-bold text-center w-16 shrink-0">
                            VS
                          </div>
                          <div className="flex-1 text-left font-medium text-gray-800 sm:pl-4 w-full sm:w-auto">{getTeamName(match.away_team_id)}</div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* RESULTADOS TAB */}
        {activeTab === "resultados" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-2">Cargar Resultados y Detalles</h2>
              <p className="text-sm text-gray-500 mb-6">Actualiza el marcador, la fecha, hora y ubicación de los partidos.</p>
              
              {matches.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                  No hay partidos para editar. Ve a Fixture para generarlos.
                </div>
              ) : (
                <div className="space-y-6">
                  {matches.map(match => (
                    <div key={match.id} className={`flex flex-col gap-4 p-5 rounded-xl border ${match.is_played ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200 hover:border-blue-200 transition-colors'}`}>
                      
                      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                        <div className="text-sm font-bold text-blue-600 uppercase tracking-wider">
                          {match.round}
                        </div>
                        {match.is_played && <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded">JUGADO</span>}
                      </div>

                      <div className="flex flex-col md:flex-row items-center gap-6">
                        
                        {/* Lado Marcador */}
                        <div className="flex-1 flex items-center justify-center gap-4 font-medium text-gray-800 w-full md:w-auto">
                          <span className="truncate flex-1 text-right">{getTeamName(match.home_team_id)}</span>
                          <input 
                            type="number" 
                            className="w-14 h-12 text-lg font-bold text-center bg-gray-50 border border-gray-300 text-gray-900 rounded focus:ring-blue-500 focus:border-blue-500 outline-none"
                            value={match.home_goals ?? ""}
                            onChange={(e) => handleMatchChange(match.id, "home_goals", e.target.value)}
                          />
                          <span className="text-gray-400 font-bold">-</span>
                          <input 
                            type="number" 
                            className="w-14 h-12 text-lg font-bold text-center bg-gray-50 border border-gray-300 text-gray-900 rounded focus:ring-blue-500 focus:border-blue-500 outline-none"
                            value={match.away_goals ?? ""}
                            onChange={(e) => handleMatchChange(match.id, "away_goals", e.target.value)}
                          />
                          <span className="truncate flex-1 text-left">{getTeamName(match.away_team_id)}</span>
                        </div>

                        {/* Lado Detalles */}
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full border-t md:border-t-0 md:border-l border-gray-200 pt-4 md:pt-0 md:pl-6">
                          <input 
                            type="date" 
                            className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded focus:ring-blue-500 focus:border-blue-500 block w-full p-2 outline-none"
                            value={match.match_date || ""}
                            onChange={(e) => handleMatchChange(match.id, "match_date", e.target.value)}
                          />
                          <input 
                            type="time" 
                            className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded focus:ring-blue-500 focus:border-blue-500 block w-full p-2 outline-none"
                            value={match.match_time || ""}
                            onChange={(e) => handleMatchChange(match.id, "match_time", e.target.value)}
                          />
                          <input 
                            type="text" 
                            placeholder="Ubicación/Cancha"
                            className="sm:col-span-2 bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded focus:ring-blue-500 focus:border-blue-500 block w-full p-2 outline-none"
                            value={match.location || ""}
                            onChange={(e) => handleMatchChange(match.id, "location", e.target.value)}
                          />
                        </div>

                        {/* Botón Guardar */}
                        <div className="w-full md:w-auto flex justify-center mt-2 md:mt-0">
                          <button 
                            onClick={() => handleSaveMatch(match.id)}
                            disabled={savingMatches[match.id]}
                            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl text-sm font-bold transition-colors shadow-sm disabled:opacity-50 w-full md:w-auto"
                          >
                            {savingMatches[match.id] ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            Guardar
                          </button>
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
