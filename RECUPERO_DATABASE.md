# Recupero su PostgreSQL gratuito

ButterflyManager ora usa PostgreSQL, quindi può funzionare sul piano gratuito di Neon. Il ripristino legge esclusivamente le sei tabelle dell'app (`User`, `Project`, `TimeEntry`, `ProjectTodo`, `Invoice`, `Payment`); `emails` e qualsiasi altra tabella nel dump vengono ignorate.

1. Crea un progetto gratuito su [Neon](https://neon.tech), quindi copia la connection string PostgreSQL con SSL.
2. Su Render, sostituisci `DATABASE_URL` con quella stringa. Non impostare `DATABASE_CA_CERTIFICATE`: Neon usa la verifica SSL standard.
3. In locale, senza salvare le credenziali nel repository, esegui:

```bash
cd /Users/diegosimoncini/Documents/Progetti/ButterflyManager
DATABASE_URL='connection-string-di-Neon' npm run db:push
DATABASE_URL='connection-string-di-Neon' npm run db:restore /Users/diegosimoncini/Downloads/defaultdb-full-backup-2026-10-05.sql.gz
```

Il comando è ripetibile: non elimina nulla e non duplica le righe già presenti. Dopo il ripristino, fai un deploy del backend su Render.

Per controllare il contenuto selezionato senza connettersi a un database, aggiungi `--dry-run` al comando di ripristino.
