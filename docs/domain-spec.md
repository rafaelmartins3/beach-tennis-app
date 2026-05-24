# Domain Spec — Agendamento de Quadras Beach Tennis

## Linguagem Ubíqua

| Termo | Definição |
|-------|-----------|
| Quadra | Espaço físico numerado (1, 2 ou 3) onde ocorre o jogo |
| Horário | Slot de tempo disponível para reserva dentro dos períodos de operação |
| Reserva | Compromisso entre cliente e espaço para uso de uma quadra em horário específico |
| Bloqueio Temporário | Estado intermediário de uma quadra reservada mas ainda sem pagamento confirmado |
| Sinal | Valor parcial pago via Pix para confirmar a reserva |
| Comprovante | Evidência de pagamento do sinal (imagem ou PDF) enviada pelo cliente |
| CPF | Identificador único do cliente no sistema |
| Período de Operação | Janelas de tempo em que o espaço aceita reservas |
| Janela de Pagamento | Período de 2 horas após o bloqueio para envio do comprovante |
| Administrador | Responsável pelo espaço que confirma comprovantes e visualiza a agenda |

---

## Bounded Contexts

### 1. Reservas (core)
Gerencia todo o ciclo de vida de uma reserva: da consulta de disponibilidade até a confirmação final.

**Responsabilidades:**
- Controlar o estado de cada quadra por horário e data
- Gerenciar o bloqueio temporário e a expiração automática
- Registrar e associar comprovantes às reservas

### 2. Clientes (suporte)
Gerencia a identidade do cliente dentro do sistema, com CPF como chave primária.

**Responsabilidades:**
- Registrar clientes por CPF
- Associar dados de contato (nome, telefone) ao CPF

### 3. Agenda (suporte)
Calcula e expõe os horários disponíveis com base nas regras de operação do espaço.

**Responsabilidades:**
- Calcular slots disponíveis por dia respeitando os períodos de operação
- Bloquear slots em datas/horários fora do período de operação

---

## Comandos

| Comando | Bounded Context | Descrição |
|---------|----------------|-----------|
| ConsultarDisponibilidade | Agenda | Cliente solicita os horários livres de uma data |
| IniciarReserva | Reservas | Cliente seleciona quadra e horário; inicia bloqueio temporário |
| RegistrarCliente | Clientes | Registra ou localiza cliente pelo CPF |
| AnexarComprovante | Reservas | Cliente faz upload do comprovante de Pix |
| LiberarQuadra | Reservas | Sistema libera automaticamente quadra com janela de pagamento expirada |

---

## Eventos de Domínio

| Evento | Disparado por | Significado |
|--------|--------------|-------------|
| DisponibilidadeConsultada | ConsultarDisponibilidade | Lista de horários livres retornada |
| ReservaIniciada | IniciarReserva | Quadra bloqueada temporariamente; janela de 2h aberta |
| ClienteRegistrado | RegistrarCliente | Novo CPF cadastrado no sistema |
| ClienteLocalizado | RegistrarCliente | CPF já existente encontrado e retornado |
| ComprovanteAnexado | AnexarComprovante | Arquivo de comprovante associado à reserva |
| ReservaConfirmada | AnexarComprovante | Reserva efetivada automaticamente ao receber o comprovante |
| JanelaDePagamentoExpirada | LiberarQuadra (automático) | 2h transcorridas sem comprovante; bloqueio encerrado |
| QuadraLiberada | LiberarQuadra | Quadra volta ao estado disponível |

---

## Erros de Domínio

| Erro | Contexto | Causa |
|------|---------|-------|
| QuadraNãoDisponível | IniciarReserva | Quadra já está bloqueada ou confirmada no horário solicitado |
| HorárioForaDeOperação | IniciarReserva / ConsultarDisponibilidade | Data/hora fora dos períodos permitidos |
| CPFInválido | RegistrarCliente | CPF com formato ou dígitos inválidos |
| ReservaNãoEncontrada | AnexarComprovante | ID de reserva inexistente ou já expirada |
| JanelaExpirada | AnexarComprovante | Tentativa de envio após as 2 horas de bloqueio |
| ArquivoInválido | AnexarComprovante | Formato não suportado ou arquivo corrompido |
| ReservaJáConfirmada | AnexarComprovante | Tentativa de enviar comprovante em reserva já confirmada |

---

## Regras de Negócio

1. **Bloqueio exclusivo:** uma quadra com bloqueio ativo não pode ser reservada por outro cliente — independente do tempo restante na janela de pagamento.

2. **Expiração automática:** exatamente 2 horas após `ReservaIniciada`, se não houver `ComprovanteAnexado`, o sistema executa `LiberarQuadra` sem intervenção humana.

3. **Identificação por CPF:** o sistema não possui senha ou login. O CPF é o único identificador do cliente. Um CPF pode ter múltiplas reservas ativas em datas distintas.

4. **Períodos de operação:**
   - Segunda a Sexta: 08h00–11h00 e 14h00–22h00
   - Sábado: 07h00–12h00
   - Domingo: espaço fechado, nenhum horário disponível

5. **Granularidade de slots:** slots de 1 hora (a definir na stack — assumido como padrão razoável para beach tennis).

6. **Confirmação automática por comprovante:** ao receber o upload do comprovante de Pix, o sistema confirma a reserva automaticamente. Não há validação manual pelo administrador no MVP.

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS |
| Estado client | TanStack Query (server state) + Zustand (UI state) |
| Backend / API | Supabase (PostgreSQL + PostgREST + Edge Functions) |
| Banco de dados | PostgreSQL 15 via Supabase |
| Storage (comprovantes) | Supabase Storage |
| Expiração automática | Supabase Edge Function agendada via pg_cron |
| Deploy frontend | Vercel ou Netlify |
| Deploy backend | Supabase Cloud |

---

## Contratos Tipados (TypeScript)

```typescript
// ─── Enums ───────────────────────────────────────────────────────────────────

export type StatusReserva = 'bloqueada' | 'confirmada' | 'expirada';

export type DiaSemana = 'segunda' | 'terca' | 'quarta' | 'quinta' | 'sexta' | 'sabado' | 'domingo';

// ─── Entidades ────────────────────────────────────────────────────────────────

export interface Quadra {
  id: number;           // 1, 2 ou 3
  nome: string;         // "Quadra 1", "Quadra 2", "Quadra 3"
}

export interface Cliente {
  id: string;           // uuid
  cpf: string;          // "000.000.000-00" (formatado)
  nome: string;
  telefone: string;
  criado_at: string;    // ISO 8601
}

export interface Reserva {
  id: string;                    // uuid
  quadra_id: number;
  cpf_cliente: string;
  data: string;                  // "YYYY-MM-DD"
  horario_inicio: string;        // "HH:00"
  horario_fim: string;           // "HH:00"
  status: StatusReserva;
  comprovante_url: string | null;
  janela_expiracao_at: string;   // ISO 8601 — criado_at + 2h
  criado_at: string;
  confirmado_at: string | null;
}

export interface SlotDisponibilidade {
  quadra_id: number;
  horario: string;               // "HH:00"
  status: 'disponivel' | 'bloqueado' | 'confirmado' | 'fora_operacao';
  reserva_id: string | null;
}

// ─── Comandos (inputs) ───────────────────────────────────────────────────────

export interface ConsultarDisponibilidadeInput {
  data: string;                  // "YYYY-MM-DD"
  quadra_id?: number;            // opcional — filtra por quadra
}

export interface IniciarReservaInput {
  quadra_id: number;
  data: string;
  horario_inicio: string;
  cpf_cliente: string;
}

export interface RegistrarClienteInput {
  cpf: string;
  nome?: string;                 // obrigatório se CPF novo
  telefone?: string;             // obrigatório se CPF novo
}

export interface AnexarComprovanteInput {
  reserva_id: string;
  arquivo: File;
}

// ─── Eventos (outputs de sucesso) ────────────────────────────────────────────

export interface DisponibilidadeConsultada {
  data: string;
  slots: SlotDisponibilidade[];
}

export interface ReservaIniciada {
  reserva: Reserva;
  janela_expiracao_at: string;
}

export interface ClienteLocalizado {
  cliente: Cliente;
  tipo: 'localizado';
}

export interface ClienteRegistrado {
  cliente: Cliente;
  tipo: 'registrado';
}

export interface ReservaConfirmada {
  reserva: Reserva;
  comprovante_url: string;
}

export interface QuadraLiberada {
  reserva_id: string;
  quadra_id: number;
  data: string;
  horario_inicio: string;
}

// ─── Erros de domínio ────────────────────────────────────────────────────────

export type ErroDominio =
  | { code: 'QUADRA_NAO_DISPONIVEL'; quadra_id: number; data: string; horario: string }
  | { code: 'HORARIO_FORA_DE_OPERACAO'; data: string; horario: string }
  | { code: 'CPF_INVALIDO'; cpf: string }
  | { code: 'RESERVA_NAO_ENCONTRADA'; reserva_id: string }
  | { code: 'JANELA_EXPIRADA'; reserva_id: string; expirou_at: string }
  | { code: 'ARQUIVO_INVALIDO'; motivo: 'formato_nao_suportado' | 'tamanho_excedido' }
  | { code: 'RESERVA_JA_CONFIRMADA'; reserva_id: string };

// ─── Resposta genérica ───────────────────────────────────────────────────────

export type Resultado<T> =
  | { ok: true; data: T }
  | { ok: false; erro: ErroDominio };
```

---

## Sensores de Banco

```sql
-- ─── Tabelas ──────────────────────────────────────────────────────────────────

CREATE TABLE quadras (
  id        SMALLINT PRIMARY KEY,    -- 1, 2, 3
  nome      TEXT NOT NULL
);

CREATE TABLE clientes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf        CHAR(14) NOT NULL UNIQUE,   -- "000.000.000-00"
  nome       TEXT NOT NULL,
  telefone   TEXT NOT NULL,
  criado_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE reservas (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quadra_id            SMALLINT NOT NULL REFERENCES quadras(id),
  cpf_cliente          CHAR(14) NOT NULL REFERENCES clientes(cpf),
  data                 DATE NOT NULL,
  horario_inicio       TIME NOT NULL,
  horario_fim          TIME NOT NULL,
  status               TEXT NOT NULL DEFAULT 'bloqueada'
                         CHECK (status IN ('bloqueada', 'confirmada', 'expirada')),
  comprovante_url      TEXT,
  janela_expiracao_at  TIMESTAMPTZ NOT NULL,
  criado_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmado_at        TIMESTAMPTZ
);

-- ─── Constraints críticos ─────────────────────────────────────────────────────

-- Bloqueio exclusivo: apenas uma reserva ativa por slot
CREATE UNIQUE INDEX idx_reserva_ativa
  ON reservas (quadra_id, data, horario_inicio)
  WHERE status IN ('bloqueada', 'confirmada');

-- ─── Função de expiração (pg_cron a cada minuto) ──────────────────────────────

CREATE OR REPLACE FUNCTION expirar_reservas()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE reservas
  SET status = 'expirada'
  WHERE status = 'bloqueada'
    AND janela_expiracao_at < now();
END;
$$;

-- Agendar via pg_cron (Supabase Dashboard → Database → Cron Jobs):
-- Schedule: "* * * * *"  →  SELECT expirar_reservas();

-- ─── RLS (Row Level Security) ─────────────────────────────────────────────────

ALTER TABLE reservas ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

-- Leitura pública da grade (necessário para ConsultarDisponibilidade)
CREATE POLICY "leitura_publica_reservas"
  ON reservas FOR SELECT USING (true);

-- Inserção pública (cliente cria reserva sem login)
CREATE POLICY "insercao_publica_reservas"
  ON reservas FOR INSERT WITH CHECK (true);

-- Atualização pública (cliente anexa comprovante)
CREATE POLICY "atualizacao_publica_comprovante"
  ON reservas FOR UPDATE
  USING (status = 'bloqueada')
  WITH CHECK (status IN ('confirmada', 'expirada'));

-- ─── Storage (Supabase) ───────────────────────────────────────────────────────

-- Bucket: "comprovantes"
-- Acesso: público para leitura (admin visualiza), público para insert
-- Path: comprovantes/{reserva_id}/{filename}
-- Tipos aceitos: image/jpeg, image/png, application/pdf
-- Tamanho máximo: 10 MB
```
