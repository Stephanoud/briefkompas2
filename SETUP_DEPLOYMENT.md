# BriefKompas.nl - Setup & Deployment Guide

## ✅ Local Setup (Windows)

### Step 1: Verify Installation

```powershell
# Check Node.js version
node --version  # Should be 18+
npm --version   # Should be 9+

# Navigate to project
cd c:\Users\steph\Documents\briefkompas2
dir  # Should see package.json, app/, components/, etc
```

### Step 2: Install Dependencies

```powershell
# Already done during initial setup, but if needed:
npm install

# This creates node_modules/ and installs:
# - next, react, react-dom
# - stripe, zustand, openai, docx
# - tailwindcss, typescript, eslint
```

### Step 3: Set Environment Variables

Create `.env.local` in the root directory:

```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51234567890
STRIPE_SECRET_KEY=sk_test_51234567890
OPENAI_API_KEY=sk-1234567890abcdef
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Get these keys from:**
1. **Stripe**: https://dashboard.stripe.com/apikeys
2. **OpenAI**: https://platform.openai.com/api-keys

### Step 4: Run Development Server

```powershell
npm run dev

# Output:
# > briefkompas2@0.1.0 dev
# > next dev
#
# ▲ Next.js 16.1.6
# - Local:        http://localhost:3000
# - Environments: .env.local
```

Open browser: `http://localhost:3000`

### Step 5: Test the Application

1. **Homepage**: Click buttons, read FAQ
2. **Bezwaar flow**: `/start-bezwaar` → answer questions → upload PDF → payment → result
3. **WOO flow**: `/start-woo` → similar flow

### Step 6: Build for Production

```powershell
# Create optimized build
npm run build

# Output shows:
# ✓ Compiled successfully
# ✓ Collecting page data
# ✓ Generating static pages

# Start production server
npm start
# Visit http://localhost:3000
```

## 🌐 Deployment to Vercel

### Prerequisites

1. **Vercel Account**: https://vercel.com/signup
2. **GitHub Account**: Push code to GitHub first

### Step 1: Push to GitHub

```powershell
# Initialize git (if not already done)
git init
git add .
git commit -m "Initial commit: BriefKompas.nl MVP 2.0"
git branch -M main

# Add your GitHub repo
git remote add origin https://github.com/YOUR_USERNAME/briefkompas.git
git push -u origin main
```

### Step 2: Deploy to Vercel

Option A: Web UI
1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Click "Deploy"
4. Set environment variables (see below)

Option B: Vercel CLI
```powershell
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Follow prompts:
# - Link to Vercel account
# - Link to existing project or create new
# - Confirm settings
```

### Step 3: Set Environment Variables

In Vercel Dashboard → Settings → Environment Variables:

```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = pk_live_51234567890...
STRIPE_SECRET_KEY = sk_live_51234567890...
OPENAI_API_KEY = sk-1234567890abcdef...
NEXT_PUBLIC_APP_URL = https://yourdomain.vercel.app
```

**Important**: Use `pk_live_` and `sk_live_` keys for production!

### Step 4: Add Custom Domain (Optional)

1. Go to Vercel Dashboard → Domains
2. Add your domain (e.g., `briefkompas.nl`)
3. Update DNS settings with Vercel's nameservers
4. Wait 24-48 hours for DNS propagation

### Step 5: Monitor Deployment

```powershell
# View logs
vercel logs YOUR_URL

# Check deployment status
vercel status YOUR_URL

# Rollback if needed
vercel rollback YOUR_URL
```

## 🧪 Testing Checklist

### Local Testing

- [ ] Homepage loads and shows pricing
- [ ] Both CTA buttons work
- [ ] All navbar links work
- [ ] FAQ section is readable
- [ ] Disclaimer and Privacy pages load

### Bezwaar Flow

- [ ] Introduction page shows info
- [ ] Chat questions appear one by one
- [ ] Validation errors show for incomplete answers
- [ ] PDF upload works
- [ ] Review page shows all data
- [ ] Pricing page shows both options
- [ ] Products can be selected
- [ ] Stripe checkout modal appears
- [ ] Test payment completes with 4242 card
- [ ] Success page confirms payment
- [ ] Generate page shows loading
- [ ] Result page shows generated letter
- [ ] Letter text can be edited
- [ ] Jurisprudence section appears (for Uitgebreid)
- [ ] Download .docx button works

### WOO Flow

- [ ] All steps same as Bezwaar
- [ ] WOO-specific questions appear
- [ ] No file upload required for Basis
- [ ] Optional bijlagen for Uitgebreid
- [ ] Letter format matches WOO structure

### Production Verification

- [ ] HTTPS connection (green lock)
- [ ] All pages accessible
- [ ] No console errors
- [ ] Images and CSS load
- [ ] Stripe production keys work
- [ ] API calls complete successfully
- [ ] Performance acceptable (Lighthouse score 85+)

## 🔧 Troubleshooting

### "Module not found" Error

```powershell
# Clear cache
rm -r node_modules
rm package-lock.json

# Reinstall
npm install
npm run dev
```

### Build Fails with TypeScript Errors

```powershell
# Check all errors
npx tsc --noEmit

# Fix in VS Code:
# - Ctrl+Shift+P → "Go to Problem"
# - Auto-fix with Ctrl+.
```

### Stripe Module Issues

```powershell
# Reinstall Stripe
npm uninstall stripe
npm install stripe
npm run build
```

### OpenAI API Errors

- Check API key is valid: https://platform.openai.com/api-keys
- Verify API has remaining credits
- Check rate limits in OpenAI dashboard
- Switch to `gpt-3.5-turbo` if `gpt-4` not available

### Port 3000 Already in Use

```powershell
# Find process using port 3000
netstat -ano | findstr :3000

# Kill process (replace PID)
taskkill /PID 5896 /F

# Or use different port
npm run dev -- -p 3001
```

## 📊 Monitoring & Maintenance

### Weekly Checks

- [ ] Check Vercel logs for errors
- [ ] Monitor OpenAI usage and costs
- [ ] Review Stripe transactions
- [ ] Check uptime status

### Monthly Tasks

- [ ] Update dependencies: `npm update`
- [ ] Review error logs
- [ ] Backup database (if implemented)
- [ ] Test disaster recovery

### Quarterly

- [ ] Major dependency updates
- [ ] Security audit
- [ ] Performance optimization
- [ ] User feedback review

## 💰 Cost Estimates

### Monthly Costs (Rough)

- **Vercel**: $20 (Pro) or free tier
- **Stripe**: 2.2% + $0.30 per transaction
- **OpenAI**: $0.002 per 1K tokens (~$50-200 depending on usage)
- **Domain**: $10-15/year

Total: ~$40-80/month for moderate usage

## 🔐 Security Checklist

- [ ] All secrets in `.env.local` (not committed)
- [ ] HTTPS enabled (automatic on Vercel)
- [ ] Stripe test keys used locally
- [ ] Production keys never in code
- [ ] API routes have rate limiting (if heavy traffic)
- [ ] Input validation on all forms
- [ ] CORS configured properly
- [ ] No sensitive data in logs

## 📞 Getting Help

### Documentation
- Check DOCUMENTATION.md for detailed architecture
- Review comments in code files
- Check Vercel logs: `vercel logs`

### External Resources
- Stripe Support: https://support.stripe.com
- OpenAI Help: https://help.openai.com
- Next.js Discussions: https://github.com/vercel/next.js/discussions
- Vercel Support: https://vercel.com/support

## 🎉 Launch Checklist

Before going live:

- [ ] All environment variables configured
- [ ] Production keys activated
- [ ] HTTPS certificate active
- [ ] Custom domain (optional)
- [ ] Privacy policy updated and ready
- [ ] Disclaimer reviewed by lawyer (optional)
- [ ] Error tracking setup (Sentry, etc)
- [ ] Analytics configured (optional)
- [ ] Email notifications setup
- [ ] Backup and restore plan
- [ ] Incident response plan

## 📝 Version History

- **v1.0.0** (2024-03-03): Initial MVP 2.0 release
  - Guided chatbot intake
  - Bezwaar and WOO flows
  - Product selection (Basis/Uitgebreid)
  - Stripe payments
  - OpenAI letter generation
  - .docx export

---

**For Updates**: Check GitHub releases and Vercel deployment history
**Support Email**: support@briefkompas.nl
