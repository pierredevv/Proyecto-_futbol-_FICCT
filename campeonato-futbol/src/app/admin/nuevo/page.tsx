"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Loader2, Trophy } from "lucide-react";

export default function NuevoTorneoPage() {
  const [nombre, setNombre] = useState("");
  const [formato, setFormato] = useState<"liga" | "eliminacion" | "grupos">("liga");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const generarSlug = (texto: string) =>
    texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return setError("El nombre es obligatorio.");
    setCargando(true);
    setError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push("/auth");

    const slug = `${generarSlug(nombre)}-${Date.now().toString(36)}`;

    const { error: dbError } = await supabase.from("tournaments").insert({
      name: nombre.trim(),
      creator_id: user.id,
      format: formato,
      status: "draft",
      slug,
    });

    if (dbError) {
      setError(dbError.message);
      setCargando(false);
    } else {
      router.push(`/admin/${slug}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-lg border border-gray-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Trophy className="w-6 h-6 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Crear Nuevo Campeonato</h1>
        </div>
        <p className="text-gray-500 mb-6 text-sm">Configura los datos básicos de tu torneo FICCT.</p>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm border border-red-100">{error}</div>}

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nombre del Torneo</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-gray-50"
              placeholder="Ej: Copa Interfacultades 2024"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Formato de Competencia</label>
            <div className="grid grid-cols-3 gap-3">
              {(["liga", "eliminacion", "grupos"] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setFormato(fmt)}
                  className={`py-3 px-2 rounded-xl border text-sm font-semibold transition ${
                    formato === fmt
                      ? "bg-blue-600 text-white border-blue-600 shadow-md"
                      : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {fmt === "liga" ? "Liga" : fmt === "eliminacion" ? "Eliminación" : "Grupos"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={cargando}
          className="mt-8 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-4 rounded-xl shadow transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {cargando ? <Loader2 className="w-5 h-5 animate-spin" /> : "Crear Campeonato"}
        </button>
      </form>
    </div>
  );
}
