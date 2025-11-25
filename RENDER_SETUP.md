# 🚀 Setup Render.com - ISTRUZIONI COMPLETE

## ⚠️ PROBLEMA ATTUALE
Il server non parte perché `DATABASE_URL` non è configurata su Render.

## ✅ SOLUZIONE - Configurare Environment Variables su Render

### Step 1: Vai su Render Dashboard
1. Apri https://dashboard.render.com
2. Seleziona il tuo **Web Service** (backend)

### Step 2: Vai su Environment
1. Clicca su **Environment** nel menu laterale
2. Clicca su **Add Environment Variable**

### Step 3: Aggiungi queste variabili OBBLIGATORIE:

#### 1. DATABASE_URL (OBBLIGATORIA!)
```
postgresql://user:password@host:port/database?sslmode=require
```

**Come ottenerla:**
- Se usi **DigitalOcean PostgreSQL**:
  1. Vai su DigitalOcean → Databases → La tua istanza
  2. Clicca su **Connection Details**
  3. Copia la **Connection String**
  4. Dovrebbe essere tipo: `postgresql://doadmin:xxx@xxx.db.ondigitalocean.com:25060/defaultdb?sslmode=require`

- Se usi un altro provider PostgreSQL:
  - Formato: `postgresql://username:password@host:port/database?sslmode=require`

#### 2. JWT_SECRET (OBBLIGATORIA!)
Genera una stringa casuale sicura (minimo 32 caratteri):
```
openssl rand -base64 32
```
Oppure usa un generatore online: https://randomkeygen.com/

#### 3. JWT_REFRESH_SECRET (OBBLIGATORIA!)
Genera un'altra stringa casuale diversa:
```
openssl rand -base64 32
```

#### 4. FRONTEND_URL (OBBLIGATORIA!)
L'URL del tuo frontend su Vercel:
```
https://butterfly-manager.vercel.app
```
(Sostituisci con il tuo URL reale)

#### 5. NODE_ENV
```
production
```

#### 6. DATABASE_CA_CERTIFICATE (Solo se usi DigitalOcean)
1. Vai su DigitalOcean → Databases → La tua istanza
2. Clicca su **Connection Details**
3. Copia il **CA Certificate** (tutto il contenuto, incluso `-----BEGIN CERTIFICATE-----` e `-----END CERTIFICATE-----`)
4. Incollalo nella variabile `DATABASE_CA_CERTIFICATE`

#### 7. PORT (Opzionale)
Render lo imposta automaticamente, ma puoi lasciarlo vuoto o impostare:
```
10000
```

### Step 4: Salva e Riavvia
1. Clicca su **Save Changes**
2. Render riavvierà automaticamente il servizio
3. Controlla i log per vedere se si connette al database

## 🔍 Verifica che funzioni

Dopo aver configurato le variabili, controlla i log su Render. Dovresti vedere:
```
✅ Connected to database
🦋 ButterflyManager server running on port 10000
```

## ❌ Se ancora non funziona

1. **Verifica che DATABASE_URL sia corretta:**
   - Deve iniziare con `postgresql://` o `postgres://`
   - Non deve avere spazi o caratteri speciali non codificati
   - La password deve essere URL-encoded se contiene caratteri speciali

2. **Verifica che il database sia accessibile:**
   - Controlla che l'IP di Render sia whitelistato nel database (se necessario)
   - Verifica che il database sia attivo

3. **Controlla i log su Render:**
   - Vai su **Logs** nel tuo servizio
   - Cerca errori di connessione

## 📝 Checklist Finale

- [ ] DATABASE_URL configurata e valida
- [ ] JWT_SECRET configurata
- [ ] JWT_REFRESH_SECRET configurata
- [ ] FRONTEND_URL configurata (URL di Vercel)
- [ ] NODE_ENV=production
- [ ] DATABASE_CA_CERTIFICATE configurata (se necessario)
- [ ] Servizio riavviato
- [ ] Log mostrano "Connected to database"

