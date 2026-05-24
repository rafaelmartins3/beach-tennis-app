# Guia de Deploy — Beach Tennis Agendamento

Este documento cobre tudo que é necessário para colocar a aplicação em produção em uma VPS, com HTTPS automático.

---

## Visão geral da arquitetura

```
Usuário (browser)
      │  HTTPS (443)
      ▼
┌─────────────────────────────────────────────────────┐
│                      VPS                           │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │  caddy:2-alpine  (porta 80 + 443)            │   │
│  │  • Emite/renova certificado Let's Encrypt    │   │
│  │  • Redireciona HTTP → HTTPS                  │   │
│  │  • Headers de segurança (HSTS, etc.)         │   │
│  └─────────────────┬────────────────────────────┘   │
│                    │ proxy interno (porta 80)        │
│  ┌─────────────────▼────────────────────────────┐   │
│  │  nginx:alpine  (exposta apenas internamente) │   │
│  │  • Serve arquivos estáticos (dist/)          │   │
│  │  • Cache de assets (1 ano, imutável)         │   │
│  │  • SPA routing (todas as rotas → index.html) │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
                       │ API calls (HTTPS)
                       ▼
              ┌─────────────────────┐
              │   Supabase Cloud    │
              │   • PostgreSQL      │
              │   • Storage         │
              │   • Edge Functions  │
              └─────────────────────┘
```

Dois containers, nenhum banco de dados na VPS. O Supabase é um serviço gerenciado externo.

---

## Pré-requisitos

### 1. VPS
Qualquer provider funciona (DigitalOcean, Hetzner, Vultr, etc.).

| Recurso | Mínimo recomendado |
|---------|-------------------|
| CPU | 1 vCPU |
| RAM | 1 GB |
| Disco | 20 GB SSD |
| OS | Ubuntu 22.04 LTS |

> **Dica:** A Hetzner CX22 (2 vCPU / 4 GB RAM / €4/mês) é uma boa relação custo-benefício para começar.

### 2. Domínio
Você precisa de um domínio ou subdomínio que aponte para o IP da VPS **antes do primeiro deploy**.

> O Caddy verifica o DNS durante a emissão do certificado. Se o DNS não apontar para a VPS, o Let's Encrypt vai recusar e o Caddy vai errar na inicialização.

### 3. Docker e Docker Compose
Instalados na VPS (passo abaixo).

### 4. Projeto no Supabase
Crie o projeto em [app.supabase.com](https://app.supabase.com) e anote:
- **Project URL**: `https://xxxxxxxxxxxx.supabase.co`
- **Anon key**: chave pública (aba *API Settings*)

---

## Passo a passo

### Etapa 1 — Configurar o DNS

No painel do seu provedor de domínio, crie um registro do tipo **A**:

```
Tipo   Nome                          Valor
A      agendamento.seudominio.com    <IP da VPS>
```

Aguarde a propagação (geralmente até 5 minutos, pode levar até 24h).

Verifique com:
```bash
dig agendamento.seudominio.com +short
# deve retornar o IP da VPS
```

---

### Etapa 2 — Instalar Docker na VPS

Conecte na VPS via SSH e rode:

```bash
# Instalação oficial do Docker Engine + Docker Compose plugin
curl -fsSL https://get.docker.com | sh

# Adiciona seu usuário ao grupo docker (evita usar sudo toda hora)
sudo usermod -aG docker $USER

# Aplica o grupo sem precisar fazer logout
newgrp docker

# Verifica instalação
docker --version
docker compose version
```

---

### Etapa 3 — Clonar o repositório

```bash
# Cria pasta para a aplicação
mkdir -p /opt/beach-tennis
cd /opt/beach-tennis

# Clona o repositório (substitua pela sua URL)
git clone https://github.com/SEU_USUARIO/beach-tennis-app.git .
```

---

### Etapa 4 — Configurar variáveis de ambiente

```bash
# Copia o template
cp .env.example .env

# Edita com seus dados reais
nano .env
```

Preencha o arquivo `.env`:

```env
# Domínio que você configurou no DNS (sem https://)
DOMAIN=agendamento.seudominio.com.br

# Dados do seu projeto Supabase
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> **Importante:** As chaves Supabase com prefixo `VITE_` são embutidas no JavaScript durante o build (são públicas por design). Nunca coloque a **service_role key** aqui — use apenas a **anon key**.

---

### Etapa 5 — Primeiro deploy

```bash
# Build da imagem + sobe os containers em background
docker compose up -d --build

# Acompanha os logs em tempo real (Ctrl+C para sair sem parar os containers)
docker compose logs -f
```

O que acontece neste momento:
1. Docker faz o build multi-stage (Node.js → `npm run build` → nginx com o `dist/`)
2. Container `app` (nginx) sobe e passa no healthcheck
3. Container `caddy` sobe, contata o Let's Encrypt e emite o certificado TLS
4. Caddy começa a responder em HTTP (redireciona para HTTPS) e HTTPS

Após ~30 segundos, acesse `https://agendamento.seudominio.com.br` — deve estar funcionando.

---

### Etapa 6 — Verificar o deploy

```bash
# Status dos containers
docker compose ps

# Esperado:
# NAME                    STATUS
# beach-tennis-app        Up X minutes (healthy)
# beach-tennis-caddy      Up X minutes

# Certificado TLS (deve mostrar dados do Let's Encrypt)
curl -sI https://agendamento.seudominio.com.br | grep -E "HTTP|server|strict"
```

---

## Atualizar a aplicação

Sempre que houver uma nova versão:

```bash
cd /opt/beach-tennis

# Puxa as alterações do repositório
git pull

# Reconstrói a imagem e reinicia os containers
# O Caddy não é reconstruído — apenas o app
docker compose up -d --build app

# Verifica se subiu sem erros
docker compose ps
docker compose logs app --tail=20
```

> O Caddy não precisa ser reiniciado na maioria dos deploys — apenas quando o `Caddyfile` for alterado.

---

## Operações do dia a dia

### Ver logs

```bash
# Todos os containers
docker compose logs -f

# Apenas o nginx (acessos)
docker compose logs -f app

# Apenas o Caddy (certificados, erros de proxy)
docker compose logs -f caddy
```

### Reiniciar um container

```bash
docker compose restart app
docker compose restart caddy
```

### Parar tudo

```bash
docker compose down
```

### Parar e remover volumes (⚠️ apaga certificados TLS — use com cuidado)

```bash
docker compose down -v
```

### Ver uso de recursos

```bash
docker stats
```

---

## Renovação do certificado TLS

O Caddy renova o certificado **automaticamente** cerca de 30 dias antes do vencimento. Nenhuma ação manual é necessária.

Para verificar o certificado atual:
```bash
docker compose exec caddy caddy list-trusted-roots
```

---

## Firewall (recomendado)

Configure o UFW para bloquear portas desnecessárias:

```bash
# Permite SSH, HTTP e HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp   # HTTP/3

# Ativa o firewall
sudo ufw enable

# Verifica
sudo ufw status
```

---

## Troubleshooting

### Container `app` não sobe
```bash
docker compose logs app
# Procure por erros de configuração do nginx
```

### Caddy não emite certificado
```bash
docker compose logs caddy
```

Causas comuns:
- **DNS não propagou ainda** — aguarde e tente `docker compose restart caddy`
- **Porta 80/443 bloqueada** — verifique o firewall da VPS e o painel do provider
- **Rate limit do Let's Encrypt** — máximo de 5 certificados por domínio por semana; aguarde ou use subdomínio diferente

### HTTPS não funciona após recriar os containers

Os certificados ficam no volume `caddy_data`. Se você rodou `docker compose down -v` sem querer, os certificados foram apagados. Suba novamente com `docker compose up -d` — o Caddy emitirá um novo certificado automaticamente.

### Aplicação carrega mas rotas diretas retornam 404

O `nginx.conf` está configurado com `try_files $uri $uri/ /index.html`. Se isso acontecer, verifique se o `nginx.conf` está sendo copiado corretamente durante o build:

```bash
docker compose exec app cat /etc/nginx/conf.d/default.conf
```

---

## Estrutura dos arquivos de infraestrutura

```
beach-tennis-app/
├── Dockerfile          # Build multi-stage: Node (build) → nginx (serve)
├── nginx.conf          # Config do nginx: SPA routing + cache de assets
├── Caddyfile           # Config do Caddy: HTTPS automático + proxy reverso
├── docker-compose.yml  # Orquestra app (nginx) + caddy
├── .env.example        # Template de variáveis de ambiente
└── .env                # Variáveis reais (NÃO commitar no git)
```

---

## Variáveis de ambiente — referência completa

| Variável | Onde usar | Descrição |
|----------|-----------|-----------|
| `DOMAIN` | `.env` | Domínio sem `https://` (ex: `agendamento.exemplo.com`) |
| `VITE_SUPABASE_URL` | `.env` | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | `.env` | Chave pública (anon) do Supabase |

> As variáveis `VITE_*` são **injetadas em tempo de build** pelo Vite e ficam embutidas no JavaScript final. Elas são públicas por design (anon key). Nunca use a `service_role key` como variável de build.
