# BriefKompas.nl - AI-Powered Dutch Administrative Letter Generator

![Next.js](https://img.shields.io/badge/Next.js-16.1-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.0-38B2AC?logo=tailwind-css)

**Production-ready MVP for generating Dutch administrative appeal letters (bezwaarschriften) and WOO requests with AI-guided chatbot intake.**

## 🎯 Key Features

✅ **Guided AI Chatbot Intake** - Conversational flow with smart validation  
✅ **Two Document Types** - Bezwaar (appeals) and WOO (information requests)  
✅ **Two Pricing Tiers** - Basis (€7,95) and Uitgebreid (€14,95)  
✅ **Professional Letter Generation** - OpenAI-powered structured letters  
✅ **Stripe Payments** - Secure checkout with test mode  
✅ **Mobile Responsive** - Clean, government-website aesthetic  
✅ **Production Ready** - TypeScript, Vercel-deployable, error-handled  

## 🚀 Quick Start

```bash
# Install
npm install

# Create .env.local with your API keys
echo "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_..." > .env.local
echo "STRIPE_SECRET_KEY=sk_test_..." >> .env.local
echo "OPENAI_API_KEY=sk-..." >> .env.local

# Run
npm run dev

# Visit http://localhost:3000
```

## 📚 Documentation

- **[DOCUMENTATION.md](./DOCUMENTATION.md)** - Full technical documentation
- **[SETUP_DEPLOYMENT.md](./SETUP_DEPLOYMENT.md)** - Setup and Vercel deployment guide

## 🏗️ Project Structure

```
app/              → Pages and API routes
components/       → Reusable UI components (Button, Card, ChatBubble, etc)
lib/              → Logic (Zustand store, intake flow, utilities)
types/            → TypeScript definitions
.env.local        → Environment variables
```

## 💳 Pricing

| | Basis | Uitgebreid |
|---|---|---|
| Price | €7,95 | €14,95 |
| PDF Upload | 1 | 1 + up to 5 bijlagen |
| Decision Summary | ❌ | ✅ |
| Jurisprudence Section | ❌ | ✅ |

## 🔄 User Flows

### Bezwaar (Appeal)
Homepage → Introduction → 7 Chat Questions → File Upload → Review → Product Selection → Stripe → Generate → Edit → Download

### WOO (Information Request)
Homepage → Introduction → 6 Chat Questions → Review → Product Selection → Stripe → Generate → Edit → Download

## 🚀 Deploy to Vercel

```bash
npm i -g vercel
vercel

# Set env vars in Vercel dashboard
```

## ⚠️ Legal Notice

This tool does NOT provide legal advice. Users are responsible for their content. See DISCLAIMER page for details.

## 📞 Support

- Docs: See DOCUMENTATION.md
- Setup: See SETUP_DEPLOYMENT.md
- Email: support@briefkompas.nl

## 📄 License

MIT License
