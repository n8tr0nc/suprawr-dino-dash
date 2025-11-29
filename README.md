<img width="1200" height="400" alt="crew-tg-001" src="https://github.com/user-attachments/assets/3de70671-dd74-4238-8b7f-48e043f63439" />

# 🦖 Suprawr Dino Dash — Gas Tracker

A lightweight Next.js dashboard that scans **$SUPRA coin transactions** for your connected Supra wallet and calculates:

* Total gas spent
* Average gas per tx
* Estimated monthly gas
* Live USD conversion
* $SUPRAWR holder rank (token-gated access)

---

## 🚀 Features

* **StarKey Wallet Connect** (auto-restore)
* **Full coin_transactions scan** via Supra RPC
* **Real-time SUPRA → USD**
* **Progress bar while scanning**
* **Requires 1,000,000+ $SUPRAWR to access**
* Shows rank: Hatchling → Primal Master

---

## 🛠️ Tech Stack

* Next.js
* React
* Axios
* Supra RPC v2

---

## 📦 Setup

```bash
npm install
npm run dev
npm run build
npm start
```

---

## 🌐 Deployment

Works on:

* **Vercel** (best)
* Netlify
* GitHub Pages (with static export)

---

## ⚠️ Notes

* Uses **coin_transactions** only
* Contract-only txs may not appear
* Gas is estimated using `max_gas_amount × gas_unit_price`

---

## 💬 Feedback

Open an issue for bugs or feature requests. RAWRpack evolves fast — so will this dashboard.
