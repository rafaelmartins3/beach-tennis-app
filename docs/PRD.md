# PRD — Agendamento de Quadras Beach Tennis

## Metadata
- Domínio: Reservas
- Appetite: pequeno (1–2sem)
- Versão: 1.0

---

## 1. Press Release
Para donos de espaços de beach tennis que gerenciam reservas manualmente, este produto permite que os próprios clientes agendem suas quadras online, eliminando o controle por papel e garantindo que apenas reservas com pagamento confirmado sejam efetivadas.

## 2. Job To Be Done
- **Quando:** quero reservar uma quadra de beach tennis
- **Eu quero:** verificar a disponibilidade e garantir meu horário sem precisar ligar ou aparecer pessoalmente
- **Para que:** eu tenha certeza do meu horário e o dono do espaço não precise gerenciar isso manualmente

## 3. Atores e Papéis
| Ator | Papel | Autonomia |
|------|-------|-----------|
| Cliente | Consulta disponibilidade, faz reserva, envia comprovante de pagamento | Autoatendimento |
| Administrador | Visualiza agenda do dia, confirma ou rejeita comprovantes | Gestão |

## 4. Sequência de Eventos (semente do DDD)

- Cliente acessa a agenda e escolhe data, horário e quadra disponível
  → evento: HorárioSelecionado / comando: IniciarReserva

- Sistema bloqueia a quadra temporariamente por 2 horas
  → evento: QuadraBloqueada

- Cliente informa CPF e dados de contato
  → evento: ClienteIdentificado / comando: RegistrarDadosCliente

- Cliente envia comprovante do Pix (sinal)
  → evento: ComprovanteEnviado / comando: AnexarComprovante

- Administrador visualiza e confirma o comprovante
  → evento: ReservaConfirmada

- Caso o comprovante não seja enviado em até 2 horas
  → evento: BloqueioExpirado / comando: LiberarQuadra

## 5. Regras de Negócio
- Uma quadra bloqueada (pagamento pendente) não pode ser reservada por outro cliente durante o período de 2 horas
- Após 2 horas sem comprovante, o bloqueio é automaticamente removido e a quadra volta a aparecer como disponível
- O cliente é identificado pelo CPF — um mesmo CPF pode ter múltiplas reservas em datas diferentes
- O sistema opera apenas nos seguintes horários:
  - Segunda a Sexta: 08h–11h e 14h–22h
  - Sábado: 07h–12h
  - Domingo: fechado
- Fora dos horários de operação, nenhum horário pode ser reservado
- O comprovante de Pix é enviado pelo cliente (upload de imagem ou PDF); a confirmação é manual pelo administrador

## 6. Appetite
- Tamanho: pequeno (1–2 semanas)
- Escopo mínimo viável: agenda por dia com visualização das 3 quadras, bloqueio temporário de 2h, cadastro por CPF, envio de comprovante e confirmação manual pelo administrador

## 7. Critérios de Aceitação
- Cliente consegue ver a disponibilidade das 3 quadras em qualquer dia disponível
- Cliente consegue iniciar uma reserva informando CPF e escolhendo horário livre
- A quadra aparece como "aguardando pagamento" imediatamente após a seleção
- Cliente consegue fazer upload do comprovante de Pix
- Após 2 horas sem comprovante, a quadra volta automaticamente ao status "disponível"
- Administrador acessa uma tela com todos os agendamentos do dia e o status de cada um (disponível / aguardando pagamento / confirmado)

## 8. Explicitamente Fora do Escopo
- Pagamento online integrado (pertence ao domínio Financeiro)
- Analytics e relatórios de ocupação (pertence ao domínio Inteligência de Negócio)
- App mobile nativo
- Cancelamento com reembolso automático
- Gestão de preços e promoções
- Ranking ou gamificação de clientes
