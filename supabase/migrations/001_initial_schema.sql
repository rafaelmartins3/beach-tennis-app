-- ═══════════════════════════════════════════════════════════════════════════
-- Beach Tennis — Agendamento de Quadras
-- Migration 001: schema inicial
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Extensões ───────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";  -- gen_random_uuid()
create extension if not exists "pg_cron";   -- job de expiração automática

-- ─── Tabela: clientes ────────────────────────────────────────────────────────

create table if not exists clientes (
  id          uuid        primary key default gen_random_uuid(),
  cpf         text        not null unique,     -- formato "000.000.000-00"
  nome        text        not null,
  telefone    text        not null,
  criado_at   timestamptz not null default now()
);

comment on table  clientes              is 'Clientes identificados por CPF';
comment on column clientes.cpf         is 'CPF formatado com pontos e traço';

-- ─── Tabela: reservas ────────────────────────────────────────────────────────

create table if not exists reservas (
  id                   uuid        primary key default gen_random_uuid(),
  quadra_id            int         not null check (quadra_id between 1 and 3),
  cpf_cliente          text        not null references clientes(cpf),
  data                 text        not null,   -- "YYYY-MM-DD"
  horario_inicio       text        not null,   -- "HH:MM"
  horario_fim          text        not null,   -- "HH:MM"
  status               text        not null default 'bloqueada'
                                   check (status in ('bloqueada', 'confirmada', 'expirada')),
  comprovante_url      text,
  janela_expiracao_at  timestamptz not null,
  criado_at            timestamptz not null default now(),
  confirmado_at        timestamptz
);

comment on table  reservas                       is 'Reservas de quadras de beach tennis';
comment on column reservas.data                  is 'Data da reserva no formato YYYY-MM-DD';
comment on column reservas.horario_inicio        is 'Horário de início no formato HH:MM';
comment on column reservas.status                is 'bloqueada=aguardando pag | confirmada=pag ok | expirada=janela vencida';

-- Índice parcial: garante unicidade de slot ATIVO (bloqueado ou confirmado).
-- Múltiplas reservas expiradas para o mesmo slot são permitidas ao longo do tempo.
create unique index if not exists uq_reserva_slot_ativo
  on reservas(quadra_id, data, horario_inicio)
  where status in ('bloqueada', 'confirmada');

-- Índice para queries por data (consultarDisponibilidade)
create index if not exists idx_reservas_data
  on reservas(data, status);

-- ─── Storage: bucket comprovantes ────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('comprovantes', 'comprovantes', true)
on conflict (id) do nothing;

-- ─── Row Level Security ───────────────────────────────────────────────────────

alter table clientes enable row level security;
alter table reservas  enable row level security;

-- Clientes: qualquer anon pode inserir e ler o próprio registro por CPF
create policy "clientes_insert" on clientes
  for insert to anon with check (true);

create policy "clientes_select" on clientes
  for select to anon using (true);

-- Reservas: qualquer anon pode ler todas (necessário para exibir disponibilidade)
create policy "reservas_select" on reservas
  for select to anon using (true);

-- Reservas: anon pode inserir (iniciarReserva)
create policy "reservas_insert" on reservas
  for insert to anon with check (true);

-- Reservas: anon pode atualizar status e comprovante (anexarComprovante, liberarQuadra)
create policy "reservas_update" on reservas
  for update to anon using (true)
  with check (true);

-- Storage: qualquer anon pode fazer upload de comprovantes
create policy "comprovantes_upload" on storage.objects
  for insert to anon with check (bucket_id = 'comprovantes');

create policy "comprovantes_select" on storage.objects
  for select to anon using (bucket_id = 'comprovantes');

-- ─── Job automático de expiração (pg_cron) ────────────────────────────────────
--
-- Roda a cada minuto e expira reservas bloqueadas com janela vencida.
-- Equivalente ao expirarReservasVencidas() do domínio.

select cron.schedule(
  'expirar-reservas-vencidas',        -- nome do job
  '* * * * *',                        -- a cada minuto
  $$
    update reservas
    set    status = 'expirada'
    where  status = 'bloqueada'
    and    janela_expiracao_at < now()
  $$
);
