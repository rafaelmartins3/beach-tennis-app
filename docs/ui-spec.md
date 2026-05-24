# UI Specification — Agendamento de Quadras Beach Tennis

---

## Telas

### 1. Agenda do Dia (Tela principal — cliente)
- **Propósito:** Permitir que o cliente visualize a disponibilidade das 3 quadras e inicie uma reserva
- **Rota:** `/`

#### Componentes

| Componente | Estados | Ações do usuário |
|-----------|---------|-----------------|
| SeletorDeData | padrão, dia indisponível (domingo) | Navegar entre dias |
| GradeDeHorários | disponível, bloqueado, confirmado, fora-de-operação | Clicar em slot disponível |
| CartãoDaQuadra | disponível, aguardando-pagamento, confirmado | — |
| BotãoIniciarReserva | habilitado, desabilitado | Clicar para iniciar reserva |
| LegendaDeStatus | estático | — |

#### Detalhes de estados — GradeDeHorários

| Estado | Disparado por | Exibe | Permite |
|--------|--------------|-------|---------|
| disponível | ConsultarDisponibilidade → DisponibilidadeConsultada | Slot em verde claro | Clicar para selecionar |
| bloqueado | ReservaIniciada → QuadraBloqueada | Slot em amarelo + ícone de relógio | Nenhuma ação |
| confirmado | ComprovanteAnexado → ReservaConfirmada | Slot em vermelho + ícone de check | Nenhuma ação |
| fora-de-operação | HorárioForaDeOperação | Slot em cinza escuro | Nenhuma ação |
| carregando | (auxiliar) | Skeleton loader sobre a grade | — |

#### Detalhes de estados — SeletorDeData

| Estado | Disparado por | Exibe | Permite |
|--------|--------------|-------|---------|
| padrão | — | Calendário semanal com dia atual destacado | Navegar entre dias |
| dia-fechado | domingo / HorárioForaDeOperação | Dia riscado ou em cinza | Nenhuma ação |

---

### 2. Fluxo de Reserva — Identificação (cliente)
- **Propósito:** Coletar o CPF do cliente para associar à reserva
- **Rota:** `/reserva/identificacao`

#### Componentes

| Componente | Estados | Ações do usuário |
|-----------|---------|-----------------|
| CampoCPF | vazio, preenchendo, válido, inválido | Digitar CPF |
| BotãoContinuar | desabilitado, habilitado | Clicar para avançar |
| MensagemDeErro | oculta, visível | — |
| ResumoDoHorário | estático | — |

#### Detalhes de estados

| Estado | Disparado por | Exibe | Permite |
|--------|--------------|-------|---------|
| cpf-inválido | CPFInválido | Mensagem "CPF inválido" abaixo do campo + borda vermelha | Corrigir e retentar |
| cpf-válido | ClienteLocalizado / ClienteRegistrado | Borda verde + nome do cliente (se já cadastrado) | Avançar |
| carregando | (auxiliar) | Spinner no botão | — |

---

### 3. Fluxo de Reserva — Dados de Contato (cliente)
- **Propósito:** Coletar nome e telefone para clientes novos (CPF não encontrado)
- **Rota:** `/reserva/contato`
- **Nota:** Esta tela só aparece se o CPF não estiver cadastrado (ClienteRegistrado novo). Se o CPF já existir (ClienteLocalizado), esta tela é pulada.

#### Componentes

| Componente | Estados | Ações do usuário |
|-----------|---------|-----------------|
| CampoNome | vazio, preenchendo, válido | Digitar nome |
| CampoTelefone | vazio, preenchendo, válido, inválido | Digitar telefone |
| BotãoConfirmar | desabilitado, habilitado | Clicar para confirmar dados |
| ResumoDoHorário | estático | — |

---

### 4. Fluxo de Reserva — Envio do Comprovante (cliente)
- **Propósito:** Solicitar o upload do comprovante de Pix para confirmar a reserva
- **Rota:** `/reserva/comprovante`

#### Componentes

| Componente | Estados | Ações do usuário |
|-----------|---------|-----------------|
| ContadorRegressivo | ativo, expirado | — |
| ÁreaDeUpload | vazia, arrastando, arquivo-selecionado, enviando, sucesso, erro | Arrastar arquivo / clicar para selecionar |
| BotãoEnviar | desabilitado, habilitado, carregando | Clicar para enviar |
| ResumoDaReserva | estático | — |
| ChavePix | estático (exibe chave para pagamento) | Copiar chave |

#### Detalhes de estados

| Estado | Disparado por | Exibe | Permite |
|--------|--------------|-------|---------|
| aguardando-upload | ReservaIniciada | Contador regressivo de 2h + área de upload vazia | Upload do arquivo |
| arquivo-selecionado | — (auxiliar) | Preview do arquivo + nome | Enviar ou trocar |
| enviando | AnexarComprovante | Spinner no botão + barra de progresso | — |
| reserva-confirmada | ReservaConfirmada | Tela de sucesso com resumo da reserva | Voltar ao início |
| janela-expirada | JanelaDePagamentoExpirada | Mensagem de expiração + botão "Nova reserva" | Iniciar nova reserva |
| arquivo-inválido | ArquivoInválido | Mensagem de erro + área de upload limpa | Tentar outro arquivo |
| reserva-não-encontrada | ReservaNãoEncontrada | Mensagem de erro + botão "Nova reserva" | Iniciar nova reserva |

---

### 5. Confirmação de Reserva (cliente)
- **Propósito:** Tela de sucesso após envio do comprovante
- **Rota:** `/reserva/confirmada`

#### Componentes

| Componente | Estados | Ações do usuário |
|-----------|---------|-----------------|
| BannerSucesso | estático | — |
| ResumoFinalDaReserva | estático | — |
| BotãoNovaReserva | padrão | Clicar para voltar ao início |

---

### 6. Painel do Administrador — Agenda do Dia
- **Propósito:** Visão geral de todos os agendamentos do dia, por quadra e horário
- **Rota:** `/admin`

#### Componentes

| Componente | Estados | Ações do usuário |
|-----------|---------|-----------------|
| SeletorDeData | padrão | Navegar entre dias |
| TabelaDeAgendamentos | carregando, populada, vazia | — |
| CartãoDeReserva | disponível, aguardando-pagamento, confirmado | Expandir para ver detalhes |
| MiniaturaDoComprovante | sem-comprovante, com-comprovante | Clicar para ampliar |
| FiltroDeQuadra | todas, quadra-1, quadra-2, quadra-3 | Filtrar por quadra |

#### Detalhes de estados — CartãoDeReserva

| Estado | Disparado por | Exibe | Permite |
|--------|--------------|-------|---------|
| disponível | DisponibilidadeConsultada | Slot em branco | — |
| aguardando-pagamento | ReservaIniciada | Nome do cliente + CPF + contador regressivo | Expandir |
| confirmado | ReservaConfirmada | Nome + horário + ícone de check verde | Expandir / ver comprovante |
| expirado | JanelaDePagamentoExpirada / QuadraLiberada | Slot liberado (volta a "disponível") | — |

---

## Fluxo de Navegação

```
[Agenda do Dia]
    ↓ clica em slot disponível
[Identificação — CPF]
    ↓ CPF novo
[Dados de Contato]
    ↓ CPF já cadastrado (pula esta tela)
[Envio do Comprovante]
    ↓ upload com sucesso
[Confirmação de Reserva]
    ↓ botão "Nova reserva"
[Agenda do Dia]

[/admin] → acesso direto (sem autenticação no MVP)
```

---

## Estados Auxiliares Globais

| Estado | Descrição |
|--------|-----------|
| carregando (skeleton) | Exibido enquanto dados de disponibilidade são buscados |
| erro-de-conexão | Exibido quando a requisição falha por problema de rede |
| tela-vazia | Exibido quando não há reservas no dia selecionado (admin) |

---

## Prompt para Figma AI / Make Designs

```
Crie um site de agendamento de quadras de beach tennis com as seguintes telas:

ESTILO VISUAL
- Tema esportivo e moderno. Paleta: verde escuro (#1B4332) como cor primária, branco e cinza claro para fundo, amarelo âmbar (#F59E0B) para status "aguardando pagamento", vermelho (#EF4444) para "confirmado/ocupado", verde claro (#D1FAE5) para "disponível".
- Tipografia limpa, sans-serif (Inter ou similar).
- Mobile-first. Layout responsivo.

TELA 1 — Agenda do Dia (home)
- Header com logo e nome do espaço.
- Seletor de data no topo (semana atual, domingo desabilitado).
- Grade de horários com 3 colunas (Quadra 1, 2, 3).
- Slots de 1h. Cores: verde=disponível, amarelo=aguardando pagamento (com ícone de relógio), vermelho=confirmado, cinza=fora de operação.
- Legenda de cores no rodapé da grade.

TELA 2 — Identificação por CPF
- Card centralizado com campo de CPF (máscara 000.000.000-00).
- Resumo do horário selecionado no topo (quadra, data, hora).
- Botão "Continuar" desabilitado até CPF válido.
- Estado de erro: borda vermelha + mensagem abaixo do campo.

TELA 3 — Dados de Contato (apenas para novos clientes)
- Campos: Nome completo, Telefone (máscara).
- Mesmo resumo do horário no topo.
- Botão "Confirmar dados".

TELA 4 — Envio do Comprovante
- Contador regressivo proeminente (2:00:00) em âmbar.
- Chave Pix do estabelecimento com botão "Copiar".
- Área de upload drag-and-drop (aceita JPG, PNG, PDF).
- Botão "Enviar comprovante" habilitado após seleção do arquivo.
- Estado de sucesso: tela verde com "Reserva confirmada!".
- Estado expirado: mensagem de aviso + botão "Nova reserva".

TELA 5 — Painel Admin (/admin)
- Tabela do dia com filtro por quadra.
- Cada linha: horário, quadra, nome do cliente, CPF, status, miniatura do comprovante.
- Status com badges coloridos (mesmas cores da grade).
- Clique na linha expande detalhes com comprovante em tamanho maior.
```

---

## Cobertura de Domínio

### Estados de domínio cobertos
- `DisponibilidadeConsultada` → slot verde na grade
- `ReservaIniciada` / `QuadraBloqueada` → slot amarelo + contador regressivo
- `ClienteRegistrado` / `ClienteLocalizado` → fluxo de identificação
- `ComprovanteAnexado` → estado de envio
- `ReservaConfirmada` → slot vermelho + tela de sucesso
- `JanelaDePagamentoExpirada` / `QuadraLiberada` → tela de expiração + slot liberado

### Erros de domínio cobertos
- `CPFInválido` → mensagem na tela 2
- `HorárioForaDeOperação` → slot cinza na grade (não clicável)
- `QuadraNãoDisponível` → slot bloqueado/confirmado na grade
- `JanelaExpirada` → tela de expiração (tela 4)
- `ArquivoInválido` → mensagem de erro na área de upload
- `ReservaNãoEncontrada` → mensagem de erro + botão nova reserva

### Estados auxiliares adicionados
- `carregando` (skeleton) — enquanto grade carrega
- `arquivo-selecionado` — preview antes do envio
- `erro-de-conexão` — falha de rede global
