# myGym

Aplicação para planear treinos, registar pesos e repetições durante a sessão e acompanhar a evolução ao longo do tempo. Interface em português de Portugal, feita com React, Vite e Bootstrap; API REST em Java/Spring Boot; dados em PostgreSQL.

## O que já funciona

- **Entrada com dois modos:** Modo Treino e Modo Histórico.
- **Planos:** criar, editar e eliminar treinos com exercícios ordenados, séries, repetições e descanso.
- **Sessão guiada:** escolher um plano, seguir os exercícios, registar aquecimento e séries de trabalho, peso, repetições e RPE opcional; corrigir uma série antes de concluir.
- **Progressão:** consultar uma tabela com as séries de trabalho do último treino concluído do mesmo exercício e plano. Se alguma série com a carga mais alta atingiu as repetições previstas e teve RPE até 8,5 (ou sem RPE), sugere mais 2 kg; caso contrário mantém a carga. O aquecimento sugerido é aproximadamente 50% da carga de trabalho, arredondado a 2,5 kg. A técnica e a capacidade no dia devem sempre prevalecer sobre a sugestão.
- **Histórico:** sessões, séries, notas, volume de trabalho e resumo geral. Os dados são guardados em PostgreSQL, não no navegador.

## Executar com Docker

```bash
cp .env.example .env
docker compose up --build
```

Abrir `http://localhost:8088`. O volume `postgres_data` mantém os dados entre arranques. Para parar: `docker compose down`.

## Desenvolvimento local

Requisitos: Java 21, Maven, Node 22, npm e PostgreSQL 16 (ou Docker para a base de dados).

```bash
docker compose up -d db
cd backend && mvn spring-boot:run
```

Noutro terminal:

```bash
cd frontend && npm ci && npm run dev
```

Abrir `http://localhost:5173`. O Vite encaminha `/api` para `localhost:8080`. A API usa `DATABASE_URL`, `DATABASE_USER`, `DATABASE_PASSWORD`, `PORT` e `CORS_ORIGIN`; os valores por defeito servem para o ambiente local. O frontend pode usar `VITE_API_URL` caso a API esteja noutro domínio.

## API REST

| Método | Rota | Uso |
| --- | --- | --- |
| GET/POST | `/api/plans` | Listar ou criar planos |
| GET/PUT/DELETE | `/api/plans/{id}` | Consultar, editar ou eliminar plano |
| POST | `/api/plans/{id}/sessions` | Iniciar sessão a partir do plano |
| GET | `/api/sessions` | Listar sessões e resumo |
| GET | `/api/sessions/{id}` | Sessão, séries e comparação anterior |
| POST | `/api/sessions/{id}/exercises/{exerciseId}/sets` | Registar série |
| DELETE | `/api/sessions/{id}/exercises/{exerciseId}/sets/{setId}` | Corrigir série |
| POST | `/api/sessions/{id}/complete` | Concluir sessão com notas |

As alterações à base de dados usam Flyway (`backend/src/main/resources/db/migration`). A API valida nomes, séries, repetições, carga e RPE.

## Preparação para publicação

`compose.yaml`, os Dockerfiles e a pipeline GitHub Actions permitem construir os serviços e validar cada alteração. Para publicar na internet, configurar um domínio com HTTPS, alterar `DATABASE_PASSWORD`, restringir a exposição da base de dados e adicionar autenticação/isolamento por utilizador. Esta primeira versão é de **utilizador único**: não deve ser publicada como serviço aberto antes dessa etapa. Guardar uma cópia de segurança regular do volume PostgreSQL.

## Estrutura

```text
backend/   Spring Boot, API REST e migrações PostgreSQL
frontend/  React, Vite, Bootstrap e Nginx para o build
compose.yaml
.github/workflows/ci.yml
```
