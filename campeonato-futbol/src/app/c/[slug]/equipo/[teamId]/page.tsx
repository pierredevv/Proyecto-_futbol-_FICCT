import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users, Shield, Hash } from "lucide-react";

export default async function TeamProfilePage({ params }: { params: Promise<{ slug: string, teamId: string }> }) {
  const { slug, teamId } = await params;
  const supabase = await createClient();

  // 1. Verificar torneo
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name, slug")
    .eq("slug", slug)
    .single();

  if (!tournament) notFound();

  // 2. Obtener equipo
  const { data: team } = await supabase
    .from("teams")
    .select("*")
    .eq("id", teamId)
    .single();

  if (!team) notFound();

  // 3. Obtener jugadores
  const { data: players } = await supabase
    .from("players")
    .select("*")
    .eq("team_id", team.id)
    .order('number', { ascending: true });

  const playersList = players || [];

  // Ordenar por posiciones si quisiéramos, pero por ahora por número está bien
  // Puedes enriquecer esto si en un futuro añades más info

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header Público con retorno */}
      <header className="bg-blue-600 text-white shadow-md relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] pointer-events-none"></div>
        <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8 relative z-10">
          <Link 
            href={`/c/${tournament.slug}`} 
            className="inline-flex items-center text-sm font-medium text-blue-100 hover:text-white transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Volver a {tournament.name}
          </Link>
          
          <div className="flex flex-col md:flex-row items-center gap-6 md:gap-8">
            {/* Escudo Gigante */}
            <div className="w-32 h-32 md:w-40 md:h-40 bg-white rounded-full flex items-center justify-center border-4 border-white shadow-xl overflow-hidden shrink-0">
              {team.logo_url ? (
                <img src={team.logo_url} className="w-full h-full object-cover" alt={`Escudo de ${team.name}`} />
              ) : (
                <span className="text-5xl font-black text-gray-300">{team.name.charAt(0)}</span>
              )}
            </div>
            
            {/* Info Equipo */}
            <div className="text-center md:text-left">
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl mb-2">{team.name}</h1>
              <p className="text-lg text-blue-200 font-medium">Plantilla Oficial</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-100 px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-bold text-gray-800">Jugadores Registrados</h2>
            </div>
            <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-bold">
              {playersList.length} Jugadores
            </div>
          </div>

          <div className="p-6">
            {playersList.length === 0 ? (
              <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-gray-700">Aún no hay jugadores</h3>
                <p className="text-gray-500 mt-1">Este equipo no ha registrado su plantilla oficial todavía.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {playersList.map((player) => (
                  <div key={player.id} className="flex items-center gap-4 bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-md transition-all group">
                    <div className="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center border border-gray-200 group-hover:bg-blue-50 group-hover:border-blue-200 transition-colors">
                      <span className="text-xl font-black text-gray-700 group-hover:text-blue-700">
                        {player.number || <Hash className="w-5 h-5 text-gray-400" />}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 group-hover:text-blue-700 transition-colors">{player.name}</h3>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-0.5">
                        {player.position || 'Jugador'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
