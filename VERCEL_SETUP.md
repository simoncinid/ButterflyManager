# 🚀 Setup Vercel - ISTRUZIONI COMPLETE

## ⚠️ PROBLEMA COMUNE: 404 Error

Se vedi errori 404 quando provi a registrarti o fare login, significa che **VITE_API_BASE_URL non è configurata su Vercel**.

## ✅ SOLUZIONE - Configurare Environment Variable su Vercel

### Step 1: Vai su Vercel Dashboard
1. Apri https://vercel.com/dashboard
2. Seleziona il tuo progetto (frontend)

### Step 2: Vai su Settings → Environment Variables
1. Clicca su **Settings** nel menu del progetto
2. Clicca su **Environment Variables** nel menu laterale

### Step 3: Aggiungi VITE_API_BASE_URL

**Nome variabile:**
```
VITE_API_BASE_URL
```

**Valore:**
```
https://butterfly-manager-backend.onrender.com/api
```
(Sostituisci `butterfly-manager-backend` con il nome reale del tuo servizio Render)

**Ambienti:**
- ✅ Production
- ✅ Preview  
- ✅ Development

### Step 4: Redeploy
1. Dopo aver aggiunto la variabile, Vercel chiederà di fare un **Redeploy**
2. Clicca su **Redeploy** o vai su **Deployments** e fai un nuovo deploy

## 🔍 Verifica che funzioni

1. Apri la console del browser (F12)
2. Dovresti vedere: `API Base URL: https://butterfly-manager-backend.onrender.com/api`
3. Quando fai una richiesta, dovresti vedere: `API Request: POST /auth/register`

## ❌ Se ancora non funziona

### 1. Verifica l'URL del backend
- Vai su Render Dashboard → il tuo Web Service
- Copia l'URL pubblico (es: `https://butterfly-manager-backend.onrender.com`)
- Aggiungi `/api` alla fine: `https://butterfly-manager-backend.onrender.com/api`

### 2. Verifica CORS sul backend
- Su Render, assicurati che `FRONTEND_URL` sia impostata con l'URL di Vercel
- Es: `FRONTEND_URL=https://butterfly-manager.vercel.app`

### 3. Controlla i log
- **Vercel**: Vai su Deployments → il tuo deploy → Functions → vedi i log
- **Render**: Vai su Logs nel tuo servizio → vedi se le richieste arrivano

### 4. Testa direttamente il backend
Apri nel browser o con curl:
```
https://butterfly-manager-backend.onrender.com/api/health
```

Dovresti vedere:
```json
{"status":"ok","timestamp":"2024-..."}
```

## 📝 Checklist Finale

- [ ] VITE_API_BASE_URL configurata su Vercel
- [ ] Valore: `https://tuo-backend.onrender.com/api`
- [ ] Ambiente: Production, Preview, Development
- [ ] Redeploy fatto dopo aver aggiunto la variabile
- [ ] FRONTEND_URL configurata su Render con URL di Vercel
- [ ] Backend risponde a `/api/health`
- [ ] Console browser mostra l'URL corretto

