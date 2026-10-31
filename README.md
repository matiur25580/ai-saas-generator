# 🚀 AI SaaS Generator — Enterprise AI Content Platform

An enterprise-grade MERN SaaS platform for AI-powered content generation with persona & tone control, credit-based subscriptions, and full history management.

![MERN](https://img.shields.io/badge/MERN-Stack-green) ![AI](https://img.shields.io/badge/AI-Gemini_OpenAI-blue) ![License](https://img.shields.io/badge/License-MIT-yellow)

## ✨ Features
- 🔐 JWT Auth + 6-digit OTP verification
- 🤖 AI Generation with 10+ Personas & 6 Tones
- 📊 User Dashboard with usage analytics & charts
- 📚 History: search, filter, copy, download PDF/TXT
- 💳 Credit-based SaaS Pricing: Free / Pro / Enterprise
- 🌙 Dark/Light theme, fully responsive
- 🚀 Production ready: Vercel (frontend) + Render (backend)

## 🛠️ Tech Stack
**Frontend:** React, Vite, Tailwind CSS, React Router, Axios, Recharts
**Backend:** Node.js, Express.js, Mongoose, JWT, Nodemailer
**Database:** MongoDB Atlas
**AI:** Google Gemini / OpenAI API
**Deploy:** Vercel + Render

## ⚙️ Setup
```bash
git clone https://github.com/matiur25580/ai-saas-generator.git
cd ai-saas-generator/backend
npm install
cp .env.example .env
# .env e MONGO_URI, JWT_SECRET, GEMINI_API_KEY bosao
npm run dev
