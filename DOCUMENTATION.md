# BriefKompas.nl - MVP 2.0 Project Documentation

## 🎯 Project Overview

BriefKompas.nl is a production-ready Next.js 14 application for generating professional Dutch administrative appeal letters (bezwaarschriften) and WOO requests (Wet open overheid verzoeken). The application uses AI-guided chatbot intake, Stripe payments, and document generation.

## 📁 Project Structure

```
briefkompas2/
├── app/
│   ├── api/
│   │   ├── generate-letter/route.ts      # OpenAI letter generation endpoint
│   │   └── stripe/checkout/route.ts      # Stripe checkout session creation
│   ├── (pages)
│   │   ├── page.tsx                      # Homepage with pricing & FAQ
│   │   ├── start-bezwaar/page.tsx        # Bezwaar introduction
│   │   ├── start-woo/page.tsx            # WOO introduction
│   │   ├── intake/[flow]/page.tsx        # Guided chatbot intake
│   │   ├── review/[flow]/page.tsx        # Review collected data
│   │   ├── pricing/[flow]/page.tsx       # Product selection
│   │   ├── checkout/success/page.tsx     # Payment success confirmation
│   │   ├── generate/[flow]/page.tsx      # Letter generation (loading)
│   │   ├── result/[flow]/page.tsx        # Final letter with editor
│   │   ├── disclaimer/page.tsx           # Legal disclaimer
│   │   ├── privacy/page.tsx              # Privacy policy
│   │   └── over/page.tsx                 # About page
│   ├── layout.tsx                        # Root layout with Header/Footer
│   └── globals.css                       # Global styles
│
├── components/
│   ├── Button.tsx                        # Reusable button component
│   ├── Card.tsx                          # Card container component
│   ├── Input.tsx                         # Text input component
│   ├── Textarea.tsx                      # Textarea component
│   ├── ChatBubble.tsx                    # Chat message display
│   ├── UploadBox.tsx                     # File upload component
│   ├── Layout.tsx                        # Header & Footer
│   ├── Alerts.tsx                        # Alert, LoadingSpinner, StepHeader
│   └── index.ts                          # Component exports
│
├── lib/
│   ├── store.ts                          # Zustand state management
│   ├── intake-flow.ts                    # Chat flow logic & validation
│   └── utils.ts                          # Utilities (pricing, docx, etc)
│
├── types/
│   └── index.ts                          # TypeScript interfaces
│
├── .env.local                            # Environment variables (keys here)
├── package.json                          # Dependencies
├── tsconfig.json                         # TypeScript config
├── tailwind.config.ts                    # Tailwind configuration
└── README.md                             # This file
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm/pnpm/yarn
- Stripe account (for testing)
- OpenAI API key

### Installation

```bash
cd c:\Users\steph\Documents\briefkompas2

# Install dependencies (already done)
npm install

# Create .env.local with your keys
# (Copy from .env.local template and fill in your keys)
```

### Environment Variables

Create `.env.local` in the root directory:

```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY_HERE
OPENAI_API_KEY=sk-YOUR_OPENAI_KEY_HERE
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Local Development

```bash
# Start development server
npm run dev

# Open browser at http://localhost:3000
```

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

## 🏗️ Architecture

### State Management (Zustand)

The app uses Zustand (`lib/store.ts`) for global state:

```typescript
- flow: "bezwaar" | "woo"
- product: "basis" | "uitgebreid"
- intakeData: IntakeFormData
- generatedLetter: GeneratedLetter
- sessionId: string (Stripe)
```

### Chat Flow Logic

`lib/intake-flow.ts` defines:
- **Bezwaar steps**: 7 questions about the appeal
- **WOO steps**: 6 questions about the document request
- **Validation**: Each step has optional validation function
- **Follow-ups**: Conditional follow-up questions for incomplete answers

### Data Flow

```
Start → Introduction → Intake Chat → Review → Product Selection
         ↓                                      ↓
      [Show info]                    [Select Basis/Uitgebreid]
                                     ↓
                                  Stripe Checkout
                                     ↓
                              Checkout Success
                                     ↓
                              Generate Letter (API)
                                     ↓
                              Result (Editable)
```

### API Routes

#### `/api/generate-letter` (POST)
- Input: `{ intakeData, product, flow }`
- Uses OpenAI GPT-3.5-turbo to generate letters
- Output: `{ letter: { letterText, references[] } }`

#### `/api/stripe/checkout` (POST)
- Input: `{ flow, product }`
- Creates Stripe checkout session
- Output: `{ checkoutUrl, sessionId }`

## 💳 Pricing & Products

### Basis €7,95
- 1 PDF upload (decision document)
- Guided intake
- Standard letter template
- .docx download

### Uitgebreid €14,95
- All Basis features
- Up to 5 additional PDFs (bijlagen)
- Decision summary
- Attachment list in letter
- Editable jurisprudence section

## 📝 Bezwaar Flow (Appeal)

1. **Introduction** - Info about timing, responsibility
2. **Chatbot Intake** - 7 guided questions
   - Government body
   - Decision date
   - Decision reference
   - Decision type (boete, uitkering, belasting, vergunning, overig)
   - Goal (withdraw, revise, delay, etc)
   - Grounds (why you disagree) - min 200 chars
   - Personal circumstances (optional)
   - PDF upload (required)
3. **Review** - Confirm all answers
4. **Product Choice** - Select Basis or Uitgebreid
5. **Payment** - Stripe checkout
6. **Generation** - AI generates letter
7. **Edit & Download** - Edit and download as .docx

**Termijn**: 6 weeks to file appeal from receiving decision

## 📖 WOO Flow (Information Request)

1. **Introduction** - Info about WOO rights
2. **Chatbot Intake** - 6 guided questions
   - Government body
   - Subject
   - Period
   - Document types
   - Digital delivery needed?
   - Urgent?
3. **Review** - Confirm answers
4. **Product Choice** - Select Basis or Uitgebreid
5. **Payment** - Stripe checkout
6. **Generation** - AI generates letter
7. **Edit & Download** - Edit and download as .docx

**Responstermijn**: 5 working days (+ 10 extra possible)

## 🎨 UI/UX Components

All components use Tailwind CSS with a clean, professional Dutch government website aesthetic:

- **Button**: Primary/secondary/danger variants
- **Card**: Container with optional title
- **Input/Textarea**: With label and error states
- **UploadBox**: Drag-and-drop file upload
- **ChatBubble**: Message display in chat
- **Alert**: Info/warning/error/success
- **StepHeader**: Progress indicator with % bar
- **Header/Footer**: Navigation and legal links

## 🔐 Security & Compliance

- HTTPS required for production
- No personal data stored permanently (deleted after order)
- PDF files uploaded to temp storage only
- Stripe handles all payment data (PCI compliant)
- OpenAI API calls for letter generation (anonimized)
- Disclaimer on every page: "This is not legal advice"

## 📦 Dependencies

### Core
- `next@16`: React framework
- `react@19`: UI library
- `typescript`: Type safety
- `tailwindcss`: Styling

### Functionality
- `stripe`: Payment processing
- `zustand`: State management
- `openai`: Letter generation
- `docx`: Word document export
- `js-cookie`: Client-side storage

### Dev
- `eslint`: Code quality
- `@types/*`: TypeScript definitions

## 🚨 Error Handling

### Intake Chat
- Validation errors per step
- Required field checks
- Follow-up questions for incomplete info

### File Uploads
- Max 10MB per file
- PDF only
- Client-side and server-side validation

### API Errors
- Letter generation failures
- Stripe session creation failures
- Proper error messages to user

### Build Errors
- TypeScript strict mode
- NextJS pre-rendering checks
- Component Suspense boundaries

## 🧪 Testing Locally

### Stripe Test Cards
```
4242 4242 4242 4242 - Success
4000 0000 0000 9995 - Decline
```

### Test Flows

**Bezwaar**:
1. Go to `/start-bezwaar`
2. Fill in test data (dates: DD-MM-YYYY format)
3. Upload any PDF file as "decision"
4. Select product
5. Use Stripe test card 4242...
6. See generated letter

**WOO**:
1. Go to `/start-woo`
2. Fill in test data
3. Select product
4. Proceed with payment
5. See generated letter

## 📱 Responsive Design

- Mobile-first approach
- Breakpoints: sm (640px), md (768px), lg (1024px)
- Touch-friendly components
- Full-width on mobile, max-width container on desktop

## 🌍 i18n (Internationalization)

Currently Dutch only (`nl-NL`). To add other languages:
1. Create translations in `locales/[lang].json`
2. Update component text to use `i18n.t()`
3. Add language selector in header

## 🔄 Deployment to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
# NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
# STRIPE_SECRET_KEY
# OPENAI_API_KEY
```

### Production Checklist
- [ ] All env vars set in Vercel
- [ ] Stripe production keys
- [ ] OpenAI key is production-ready
- [ ] Disable analytics tracking or set appropriately
- [ ] Review disclaimer and privacy policy
- [ ] Test full payment flow
- [ ] Monitor error logs

## 🐛 Debugging

### Enable verbose logging
```typescript
// In any component or API route
console.log("Debug:", { store, data, error });
```

### Build issues
```bash
# Clear build cache
rm -rf .next

# Rebuild
npm run build
```

### Type errors
```bash
# Full TypeScript check
npx tsc --noEmit
```

## 📞 Support & Maintenance

### Common Issues

**"Cannot find module" error**
- Clear `node_modules` and run `npm install`
- Check import aliases in `tsconfig.json`

**Stripe errors**
- Verify env keys are correct
- Check Stripe dashboard for API version compatibility

**OpenAI errors**
- Verify API key is valid
- Check remaining credits
- Monitor rate limits

## 📚 Additional Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Stripe API Reference](https://stripe.com/docs/api)
- [OpenAI Documentation](https://platform.openai.com/docs)
- [Tailwind CSS](https://tailwindcss.com)
- [Dutch Administrative Law](https://www.rijksoverheid.nl)

## 📄 Legal Disclaimers

All pages include disclaimers that:
- This is NOT legal advice
- User is responsible for content
- BriefKompas is not liable for outcomes
- Recommend consulting lawyer for complex cases

## 🎓 Learning Resources

For understanding the codebase:
1. Start with `app/page.tsx` (homepage)
2. Follow a complete flow: `app/start-bezwaar` → `app/intake`
3. Review `lib/store.ts` for state management
4. Check API routes in `app/api/`
5. Study component composition in `components/`

---

**Version**: 1.0.0  
**Last Updated**: March 2024  
**Author**: BriefKompas Development Team
