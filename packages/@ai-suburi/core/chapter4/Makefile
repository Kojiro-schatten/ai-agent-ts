.PHONY: start.engine
start.engine:
	@docker compose up -d

.PHONY: stop.engine
stop.engine:
	@docker compose down

.PHONY: create.index
create.index:
	@npx tsx scripts/create-index.ts

.PHONY: delete.index
delete.index:
	@npx tsx scripts/delete-index.ts
