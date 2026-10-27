# Sentinel — Fraud Investigation Frontend (Demo)

React + Vite hackathon frontend. Uses fictional demo data only. No Supabase or n8n integration and no live fraud detection.

## Use in an existing Vite project

1. Install packages: `npm install react-router-dom lucide-react recharts`
2. Copy the supplied `src` folder contents into your project's `src` folder (back up your existing App.jsx first).
3. Run: `npm run dev`

## Or run the full provided project

`npm install` then `npm run dev`.

## Notes

Demo analyst decisions are saved in React state only; they disappear on refresh. Risk scores, explanations, summaries and charts are synthetic. No real accounts or credentials are included. For Supabase, coordinate schema and RLS with the backend teammate. Do not put service-role keys in frontend environment variables.
