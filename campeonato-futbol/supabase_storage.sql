-- Crear un nuevo bucket público para imágenes del torneo (escudos, fotos de jugadores)
insert into storage.buckets (id, name, public)
values ('tournaments_media', 'tournaments_media', true)
on conflict (id) do nothing;

-- Habilitar RLS en objetos de storage
alter table storage.objects enable row level security;

-- Política 1: Todos pueden leer las imágenes (es un bucket público)
create policy "Public Access"
on storage.objects for select
using ( bucket_id = 'tournaments_media' );

-- Política 2: Usuarios autenticados pueden subir imágenes
create policy "Autenticados pueden subir"
on storage.objects for insert
with check (
  bucket_id = 'tournaments_media'
  and auth.role() = 'authenticated'
);

-- Política 3: Usuarios autenticados pueden actualizar/borrar sus propias imágenes
create policy "Usuarios pueden actualizar sus propias imagenes"
on storage.objects for update
using (
  bucket_id = 'tournaments_media'
  and auth.uid() = owner
);

create policy "Usuarios pueden borrar sus propias imagenes"
on storage.objects for delete
using (
  bucket_id = 'tournaments_media'
  and auth.uid() = owner
);
